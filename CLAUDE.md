# 工作方式

- `SPEC.md` 是唯一的规格来源，下面已导入。
- 改行为：先改 SPEC.md（新增或修改验收条目），再改代码和测试，三者保持一致。
- 只是重构、不改行为：不用动 SPEC.md。
- README.md 只写给使用者看（是什么、怎么装、怎么用）；规格和实现细节只写在 SPEC.md。
- 提交前跑 `bun run check`。
- 保持简单：不加其他文档，不加没要求的功能。

# 在浏览器里验证

- 用 Claude in Chrome 在用户已登录的真实 Chrome 里测（`bun run dev` 的构建已由用户手动加载）。
- Claude in Chrome 打不开 `chrome://` 页面，computer use 对 Chrome 只有只读权限：
  加载扩展、点 ↻ 重载都只能请用户自己在 `chrome://extensions` 里点。
- 改完代码先确认页面里跑的是新代码（热重载偶尔不生效，见 SPEC §7），再下结论。
- 会写入真实观看记录的操作（点按钮、打开 `/watch` 页会自动播放）先征得用户同意；
  优先用已经在记录里的视频，打开 `/watch` 后立刻暂停。

@SPEC.md
