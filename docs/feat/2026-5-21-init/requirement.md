# 项目名称
ddo-swe

# 背景
实现一个AI编程的可定制化的pipeline skill，通过预设的流程和原子任务节点可以进行代码开发，通过创建原子任务可以动态编排pipeline

# 需求
pipeline流程有：

——————————————————————————————————————————————————
1. Context
读入当前项目的基础信息，补充基础的上下文。
基础信息包含：AGENTS.md、README.md、product.md、（用户自定义的路径下的目录）...

2. Requirement
用户编写requirement.md或直接用户直接输入提示词告知AI当前步骤是什么需求。

3. Specification
AI通过读取requirement.md，在目标目录中生成一个yy-mm-dd-(desp)的文件夹，后续生成的文件都放到这个目录下，然后生成一份AI理解后的spec.md。
spec.md生成后需要用户进行确认是否符合预期，若同意同继续执行下一步流程。

4. Planning
基于plan.md，AI生成一份具体的技术方案文档plan.md进行技术决策。
plan.md生成后需要用户进行确认是否符合预期，若同意同继续执行下一步流程。

5. Test-Planning
基于spec.md，AI生成一份具体的技术方案文档test-plan.md文件，进行验收标准定义。
test-plan.md生成后需要用户进行确认是否符合预期，若同意同继续执行下一步流程。

6. Tasking
基于plan.md和test-plan.md生成一系列的task列表。
task存储形式如下：
在目录中创建一个tasks目录，然后在tasks目录中生成task-01.md等等每步任务的具体信息，并生成一份task-group.json的文档，用于标识task的执行的前后顺序以及是否可以并行开发。

7. Coding
AI根据task执行

8. Verification
根据test-plan.md，AI对生成的代码进行验收，若验收不通过则返回上一步，直到全部运行成功。

9. Review
（预留该阶段，后续需要配置atom-task进行review）

10. Reporting
根据上面的流程生成一份执行报告execution-report.md。

11. Reflection
检查项目中是否存在需要执行的后续流程，若存在执行

12. done

——————————————————————————————————————————————————

我期望项目中存在以下目录结构：
1. config.json：为默认的流水线配置信息
2. atom-tasks目录：目录里面存储所有抽象的原子任务（原子任务要按照json的格式来写），原子任务可以在config.json中进行配置到对应的流程中，这一步是为了将流水线和原子任务解耦
3. （后续的你设计一下）

我希望给一个可视化页面，可以通过可视化页面配置流水线信息和检查流水线执行状态。
这个前端页面要求一定要尽量简化，我期望尽量使用原生html+css+js的形式，修改的都是skill存储的目录中的config.json文件（这部分你也来设计一下）