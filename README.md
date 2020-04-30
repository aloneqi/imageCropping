# 图片裁剪插件

支持正反向裁剪。

<img src="./readmeImg/picture.jpg" width="300" />
<br/>

## 代码片段

```js
var imageCropping = new ImageCropping({
    canvas: document.querySelector('canvas'),  // 必填
    img: myImg,                                // 必填
    maxWidth: 800,                             // 可选，设置canvas宽度最大值
//  maxHeight                                  // 可选，设置canvas高度最大值
});
```

### 使用方法

[浏览 HTML 文件](https://github.com/aloneqi/imageCropping/blob/master/index.html)。
