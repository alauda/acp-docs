FROM build-harbor.alauda.cn/ops/alpine:3.14.0

RUN mkdir -p /dist/

COPY dist/ /dist/
