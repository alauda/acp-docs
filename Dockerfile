FROM build-harbor.alauda.cn/ops/alpine:3.21.3-alauda-202502271510

RUN mkdir -p /dist/

COPY dist/ /dist/
