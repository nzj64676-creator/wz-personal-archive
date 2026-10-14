# 金鱼观察室：第一阶段

开发分支：`feat/realistic-goldfish-phase1`。入口为 `aquarium.html`，理想生活页面保留原有内容并增加观察室链接。正式 GitHub Pages 仍从 main 发布，开发分支不会自动替换它。

## 本地运行

在仓库根目录启动静态 HTTP 服务，例如：

```sh
python -m http.server 8091 --bind 127.0.0.1
```

浏览器打开 `http://127.0.0.1:8091/aquarium.html`。请通过 HTTP 地址打开；直接双击 HTML 的 file:// 地址不能加载 ES 模块和 GLB。

## 已实现的第一条金鱼

- Three.js r180 / WebGL 2，库、加载器、模型与嵌入贴图均保存在本地，不依赖运行时 CDN。
- somitsu 的 Comet goldfish：10 个实际蒙皮网格、10,916 个三角面、47 个骨骼关节、127 条动画轨道；鱼身、双眼和各鱼鳍是独立的实体网格。鱼鳍膜采用原模型的透明贴图。
- 原作者游动动画驱动身体、尾鳍、各鱼鳍、嘴和鱼鳃。用两份动画动作的平滑重叠处理原片段首尾不一致，叠加轻微转向弯曲。
- 金鱼在 X/Y/Z 三个方向游动，随机目标、变速、有限加速度和四元数转向，提前避墙。没有固定二维轨迹或位置传送。
- 拖动旋转、滚轮缩放、暂停/继续、近看、俯视与重置。画布可用方向键旋转、加减键缩放。系统减少动态效果偏好会让金鱼初始暂停。
- 沿用原网站黑金界面、系统字体和客厅背景；玻璃缸与暖光只是第一阶段的观察环境。

## 来源与许可

“Comet goldfish” by [somitsu](https://sketchfab.com/somitsu), [原作品](https://sketchfab.com/3d-models/comet-goldfish-5adcbf784df540a0b46dae8950bd3ec6), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。经 Ai2 官方公开 [Objaverse 数据集](https://huggingface.co/datasets/allenai/objaverse)取得。GLB 按下载版本原样保存；仅在运行时调整材质、比例、照明、动画循环过渡与移动控制。原作者不为本网站背书。

模型署名与确切下载地址、校验值保存在 `assets/aquarium/models/ATTRIBUTION.md` 和 `provenance.json`。下载版是五张 1024×1024 嵌入式 PNG 贴图，不是 4K。Three.js 原始 MIT 许可保存在 `assets/vendor/three/LICENSE`。

## 建议验收方法

1. 用电脑上的新版 Chrome 或 Edge 打开预览，等待加载结束。点击“近看金鱼”。
2. 暂停游动，拖动视角看侧面、正面、背面和俯视。检查鱼身厚度、鳞片、眼睛、鳃盖以及尾鳍的独立形状。
3. 继续游动至少一分钟，观察尾巴和各鱼鳍，留意转弯、速度变化及动画衔接有无突然跳动。
4. 滚轮拉近和拉远，测试暂停、俯视与重置。宽屏和窄屏都应能操作。
5. 金鱼的写实程度和运动自然度需要由你在自己的电脑上验收。当前版本不宣称已达到照片级效果；五条鱼、投喂/进食、昼夜、图鉴、水草、水波和沉浸模式留待第一条鱼确认后继续。

## 开发与渲染证据

`?debug` 参数开启只用于验证的 `window.aquariumDebug`。验证实际可见像素、真实蒙皮顶点变化、骨骼位移/旋转、三轴运动及动画循环。加载失败时显示错误，不会用图片或简化模型替换金鱼。

正式发布前需要金鱼视觉验收。此分支不应在尚未验收时合并到 main。
