export interface RefDoc {
  content: string
  cos_sim: number
  id: number
  path: string
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  refDocs?: RefDoc[]
}
