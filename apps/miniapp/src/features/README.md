# Features

纯客户端 feature/view-model 放在这里。业务事实仍由服务端权威决定。C-015 的
analytics sender 只做页面生命周期内存去重；网络失败不写 storage、不排队、不重试。
