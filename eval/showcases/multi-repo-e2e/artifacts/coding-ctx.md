# coding exec 注入的「Context: 工作目录」（multi 分支实录）

## Context: 工作目录

- 生效工作目录（主仓库锚点）：/tmp/ddo-multi-e2e/svc-api-feat-api-web-version/svc-api
- 本次为多仓库隔离 run，容器根：/tmp/ddo-multi-e2e/svc-api-feat-api-web-version；run 材料（.ddo）位于容器根，不属于任何仓库。
- 涉及的全部工作目录：
- svc-api（主仓库）：/tmp/ddo-multi-e2e/svc-api-feat-api-web-version/svc-api
- svc-web（成员仓库）：/tmp/ddo-multi-e2e/svc-api-feat-api-web-version/svc-web
- 各仓库的文件改动与命令执行限定在其对应工作目录内；分支与归属见 state.git.repos。
