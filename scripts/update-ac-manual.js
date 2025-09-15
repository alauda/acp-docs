#!/usr/bin/env node

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

const AC_REPO_URL = 'git@gitlab-ce.alauda.cn:alauda/ac.git';
const TEMP_DIR = join(projectRoot, 'local', 'temp-ac-clone');
const AC_MANUAL_SOURCE = join(TEMP_DIR, 'manual');
const AC_DOCS_TARGET = join(projectRoot, 'docs', 'en', 'ui', 'cli_tools', 'ac');

async function checkGitAvailable() {
  try {
    execSync('git --version', { stdio: 'ignore' });
  } catch (error) {
    throw new Error('Git is not available. Please install git first.');
  }
}

async function cloneACRepo(branch = 'main') {
  console.log(`Cloning AC repository from ${AC_REPO_URL} (branch: ${branch})...`);
  
  // Ensure local directory exists
  const localDir = join(projectRoot, 'local');
  try {
    await fs.mkdir(localDir, { recursive: true });
  } catch (error) {
    // Ignore error if directory already exists
  }
  
  // Remove temp directory if it exists
  try {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
  } catch (error) {
    // Ignore error if directory doesn't exist
  }

  try {
    execSync(`git clone --depth=1 --branch=${branch} ${AC_REPO_URL} ${TEMP_DIR}`, {
      stdio: 'inherit',
      timeout: 60000 // 60 second timeout
    });
    console.log('Repository cloned successfully.');
  } catch (error) {
    if (error.message.includes('Authentication failed')) {
      throw new Error(`Authentication failed for ${AC_REPO_URL}. Please ensure you have access to the repository and your git credentials are configured properly.`);
    } else if (error.message.includes('timeout')) {
      throw new Error(`Git clone operation timed out. Please check your network connection and try again.`);
    } else {
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }
}

async function checkManualDirectory() {
  try {
    const stats = await fs.stat(AC_MANUAL_SOURCE);
    if (!stats.isDirectory()) {
      throw new Error(`${AC_MANUAL_SOURCE} is not a directory`);
    }
  } catch (error) {
    throw new Error(`Manual directory not found at ${AC_MANUAL_SOURCE}: ${error.message}`);
  }
}

async function removeNumberPrefixes(files) {
  const processedFiles = [];
  
  for (const file of files) {
    if (file.endsWith('.md') || file.endsWith('.mdx')) {
      // Remove number prefix pattern like "01_", "02_", etc.
      const newName = file.replace(/^\d+_/, '');
      processedFiles.push({
        originalName: file,
        newName: newName,
        shouldRename: file !== newName
      });
    } else {
      // Keep non-markdown files as-is
      processedFiles.push({
        originalName: file,
        newName: file,
        shouldRename: false
      });
    }
  }
  
  return processedFiles;
}

async function ensureTargetDirectory() {
  try {
    await fs.mkdir(AC_DOCS_TARGET, { recursive: true });
    console.log(`Ensured target directory exists: ${AC_DOCS_TARGET}`);
  } catch (error) {
    throw new Error(`Failed to create target directory: ${error.message}`);
  }
}

async function copyAndRenameFiles() {
  console.log('Reading manual directory...');
  
  const files = await fs.readdir(AC_MANUAL_SOURCE);
  const processedFiles = await removeNumberPrefixes(files);
  
  console.log(`Found ${files.length} files in manual directory.`);
  
  // Ensure target directory exists
  await ensureTargetDirectory();
  
  // Remove existing files in target directory (except index.mdx)
  try {
    const existingFiles = await fs.readdir(AC_DOCS_TARGET);
    for (const file of existingFiles) {
      if (file !== 'index.mdx') {
        await fs.rm(join(AC_DOCS_TARGET, file), { recursive: true, force: true });
        console.log(`Removed existing file: ${file}`);
      }
    }
  } catch (error) {
    // Ignore if target directory is empty or doesn't exist
  }
  
  // Copy and rename files
  for (const fileInfo of processedFiles) {
    const sourcePath = join(AC_MANUAL_SOURCE, fileInfo.originalName);
    const targetPath = join(AC_DOCS_TARGET, fileInfo.newName);
    
    try {
      const stats = await fs.stat(sourcePath);
      
      if (stats.isFile()) {
        await fs.copyFile(sourcePath, targetPath);
        if (fileInfo.shouldRename) {
          console.log(`Copied and renamed: ${fileInfo.originalName} -> ${fileInfo.newName}`);
        } else {
          console.log(`Copied: ${fileInfo.originalName}`);
        }
      } else if (stats.isDirectory()) {
        // Copy directory recursively
        await fs.cp(sourcePath, targetPath, { recursive: true });
        console.log(`Copied directory: ${fileInfo.originalName}`);
      }
    } catch (error) {
      console.error(`Failed to copy ${fileInfo.originalName}: ${error.message}`);
    }
  }
}

async function cleanup() {
  console.log('Cleaning up temporary files...');
  try {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
    console.log('Cleanup completed.');
  } catch (error) {
    console.warn(`Warning: Failed to cleanup temp directory: ${error.message}`);
  }
}

async function main() {
  const branch = process.argv[2] || 'main';
  
  try {
    console.log('Starting AC manual update process...');
    
    await checkGitAvailable();
    await cloneACRepo(branch);
    await checkManualDirectory();
    await copyAndRenameFiles();
    await cleanup();
    
    console.log('✅ AC manual update completed successfully!');
    console.log(`📁 Files have been copied to: ${AC_DOCS_TARGET}`);
    
  } catch (error) {
    console.error('❌ Error during AC manual update:', error.message);
    
    // Attempt cleanup even if there was an error
    try {
      await cleanup();
    } catch (cleanupError) {
      console.warn('Warning: Failed to cleanup after error:', cleanupError.message);
    }
    
    process.exit(1);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };