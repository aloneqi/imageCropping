var ImageCropping = function (deploy) {
    this.canvas = deploy.canvas;
    this.img = deploy.img;
    this.fixedBool = this.toString.call(deploy.fixed) === '[object Object]';
    this.unfixedBool = this.toString.call(deploy.unfixed) === '[object Object]';
    if (this.fixedBool && this.unfixedBool) throw 'fixed and unfixed attributes cannot be written simultaneously';
    if (!this.fixedBool && !this.unfixedBool) throw 'the fixed or unfixed property is not an Object';
    this.init(deploy.fixed || deploy.unfixed);
};
ImageCropping.prototype = {
    init: function (style) {
        this.fitSize(style);
        this.ctx = this.canvas.getContext('2d');

        this.isMouseover = false;
        this.isThrottle = false; // 是否开启帧循环

        if (this.fixedBool) this.fixed();

        if (this.unfixedBool) this.unfixed();

        this.canvas.onmouseenter = function () {
            this.isMouseover = true;
            this.isThrottle = true; // 开启帧循环
            this.throttle(); // 运行帧循环
        }.bind(this);

        this.canvas.onmousedown = function (e) {
            this.method = void 0; // 重置已捕获得到的方法
            this.isCapture = true; // 是否继续往下捕获绘制区域在同一个点上的方法
            this.isMousemove = true;
            this.offsetX = e.offsetX;
            this.offsetY = e.offsetY;
            this.draw();
        }.bind(this);

        this.canvas.onmousemove = function (e) {
            this.offsetX = e.offsetX;
            this.offsetY = e.offsetY;
            if (this.isMousemove) {
                this.isCapture && (this.isCapture = !this.isCapture);
            } else {
                this.fixedBool && (this.cursorValue.new = 'move'); // 重置光标值
                this.unfixedBool && (this.cursorValue.new = 'auto'); // 重置光标值
            }
        }.bind(this);

        this.canvas.onmouseleave = this.canvas.onmouseup = function (e) {
            // 这个判断暂时没用，这是为了将来可能兼容web端而做准备，填坑靠缘分
            if (!this.isMouseover || e.type === 'mouseleave') {
                this.isThrottle = false;
                this.isMouseover && (this.isMouseover = false);
            }

            this.isMousemove = false;
            this.isCapture = false;
            this.method = void 0;
            // 当高亮区域反转时宽高是负数，需要重新校正位置和大小
            this.unfixedBool && this.regionalCorrection();
        }.bind(this);

        this.draw();
    },
    unfixed: function () {
        this.isMousemove = false; // 捕获绘制区域的方法或光标 值是true时捕获方法，是false时捕获光标
        this.coordinatePoint = []; // 记录上一个点的坐标位置
        this.cursorValue = { old: 'auto', new: 'auto' }; // 记录新旧光标值
        this.zoomPointArr = [0, 0, 1, 0, 2, 0, 2, 1, 2, 2, 1, 2, 0, 2, 0, 1]; // 8个拖拽点坐标
        this.resizeArr = ['nw-resize', 'n-resize', 'ne-resize', 'e-resize', 'se-resize', 's-resize', 'sw-resize', 'w-resize']; // 8个方向光标
        this.lineDash = [5, 5]; // 虚线间隔宽度
        this.borderWidth = 2; // 边框宽度
        this.draw = this.unfixedDraw;
    },
    fixed: function () {
        this.coordinatePoint = [0, 0];
        this.offsetX = this.offsetY = 0;
        this.cursorValue = { old: 'auto', new: 'move' }; // 记录新旧光标值
        this.draw = this.fixedDraw;
    },
    fixedDraw: function () {
        this.ctx.clearRect(-this.rangeMovement.left, -this.rangeMovement.top, this.imageWidth * this.ratio, this.imageHeight * this.ratio);
        this.method && this.method(this.offsetX, this.offsetY); // 运行已捕获得到的方法

        this.fixedRectangle();
        this.regionZoom();

        this.recordPoint(); // 记录上一个位置
        if (!this.isMousemove) this.setCursor(); // 更新光标
    },
    unfixedDraw: function () {
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.method && this.method(this.offsetX, this.offsetY); // 运行已捕获得到的方法
        this.boundaryDetection(); // canvas边界判定
        this.ctx.drawImage(this.img, 0, 0, this.canvasWidth, this.canvasHeight); // 绘制背景图片
        this.masking(); // 绘制蒙层
        this.brightArea(); // 绘制高亮区域
        this.gridding(); // 绘制网格
        this.border(); // 绘制边框
        this.zoomPoint(); // 绘制拖拽缩放点
        this.recordPoint(); // 记录上一个位置
        if (!this.isMousemove) this.setCursor(); // 更新光标
    },
    masking: function () {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.globalAlpha = 0.5;
        this.ctx.fillStyle = 'black';
        this.ctx.rect(0, 0, this.canvasWidth, this.canvasHeight);
        this.ctx.fill();
        this.ctx.closePath();
        this.ctx.restore();
    },
    border: function () {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#4166f5';
        this.ctx.lineWidth = this.borderWidth;
        this.ctx.rect(this.brightAreaRect[0][0], this.brightAreaRect[1][0], this.brightAreaRect[0][1], this.brightAreaRect[1][1]);
        this.ctx.stroke();
        this.ctx.closePath();
        this.ctx.restore();
    },
    brightArea: function () {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(this.brightAreaRect[0][0], this.brightAreaRect[1][0], this.brightAreaRect[0][1], this.brightAreaRect[1][1]);
        this.ctx.clip();
        this.ctx.drawImage(this.img, 0, 0, this.canvasWidth, this.canvasHeight);
        this.ctx.closePath();
        this.ctx.restore();
        if (this.ctx.isPointInPath(this.offsetX, this.offsetY)) {
            this.isCapture && (this.method = this.translationFn);
            !this.isMousemove && (this.cursorValue.new = 'move');
        }
    },
    gridding: function () {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'white';
        this.ctx.setLineDash(this.lineDash);
        for (var i = 0, len = this.brightAreaRect.length; i < len; i++) {
            this.ctx.moveTo(this.brightAreaRect[0][0], this.brightAreaRect[1][0] + ((i + 1) * this.brightAreaRect[1][1]) / 3);
            this.ctx.lineTo(this.brightAreaRect[0][0] + this.brightAreaRect[0][1], this.brightAreaRect[1][0] + ((i + 1) * this.brightAreaRect[1][1]) / 3);
            this.ctx.stroke();

            this.ctx.moveTo(this.brightAreaRect[0][0] + ((i + 1) * this.brightAreaRect[0][1]) / 3, this.brightAreaRect[1][0]);
            this.ctx.lineTo(this.brightAreaRect[0][0] + ((i + 1) * this.brightAreaRect[0][1]) / 3, this.brightAreaRect[1][0] + this.brightAreaRect[1][1]);
            this.ctx.stroke();
        }
        this.ctx.closePath();
        this.ctx.restore();
    },
    zoomPoint: function () {
        var width = this.brightAreaRect[0][1] / 2,
            height = this.brightAreaRect[1][1] / 2;

        for (var i = 0, len = this.zoomPointArr.length / 2; i < len; i++) {
            point.call(this, this.zoomPointArr[i * 2], this.zoomPointArr[i * 2 + 1], this.brightAreaRect[0][0], this.brightAreaRect[1][0], width, height, i);
        }

        function point(lx, ly, x, y, width, height, num) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#4166f5';
            this.ctx.fillStyle = 'white';
            this.ctx.arc(x + width * lx, y + height * ly, 4, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
            this.ctx.closePath();
            if (this.ctx.isPointInPath(this.offsetX, this.offsetY)) {
                this.isCapture && (this.method = this.zoomMethod(num));
                !this.isMousemove && (this.cursorValue.new = this.resizeArr[num]);
            }
        }
    },
    zoomMethod: function (num) {
        if (num === 0)
            return function (x, y) {
                this.brightAreaRect[0][1] -= x - this.brightAreaRect[0][0];
                this.brightAreaRect[0][0] = x;
                this.brightAreaRect[1][1] -= y - this.brightAreaRect[1][0];
                this.brightAreaRect[1][0] = y;
            };

        if (num === 1)
            return function (x, y) {
                this.brightAreaRect[1][1] -= y - this.brightAreaRect[1][0];
                this.brightAreaRect[1][0] = y;
            };

        if (num === 2)
            return function (x, y) {
                this.brightAreaRect[0][1] += x - this.coordinatePoint[0];
                this.brightAreaRect[1][1] -= y - this.brightAreaRect[1][0];
                this.brightAreaRect[1][0] = y;
            };
        if (num === 3)
            return function (x, y) {
                this.brightAreaRect[0][1] += x - this.coordinatePoint[0];
            };

        if (num === 4)
            return function (x, y) {
                this.brightAreaRect[0][1] += x - this.coordinatePoint[0];
                this.brightAreaRect[1][1] += y - this.coordinatePoint[1];
            };

        if (num === 5)
            return function (x, y) {
                this.brightAreaRect[1][1] += y - this.coordinatePoint[1];
            };

        if (num === 6)
            return function (x, y) {
                this.brightAreaRect[0][1] -= x - this.coordinatePoint[0];
                this.brightAreaRect[0][0] = x;
                this.brightAreaRect[1][1] += y - this.coordinatePoint[1];
            };

        if (num === 7)
            return function (x, y) {
                this.brightAreaRect[0][1] -= x - this.coordinatePoint[0];
                this.brightAreaRect[0][0] = x;
            };
    },
    translationFn: function (x, y) {
        this.brightAreaRect[0][0] += x - this.coordinatePoint[0];
        this.brightAreaRect[1][0] += y - this.coordinatePoint[1];
    },
    recordPoint: function () {
        this.coordinatePoint[0] = this.offsetX;
        this.coordinatePoint[1] = this.offsetY;
    },
    boundaryDetection: function () {
        if (Math.abs(this.brightAreaRect[0][1]) > this.canvasWidth) (this.brightAreaRect[0][0] = 0), (this.brightAreaRect[0][1] = this.canvasWidth);
        if (Math.abs(this.brightAreaRect[1][1]) > this.canvasHeight) (this.brightAreaRect[1][0] = 0), (this.brightAreaRect[1][1] = this.canvasHeight);

        this.brightAreaRect[0][0] < 0 && (this.brightAreaRect[0][0] = 0);
        this.brightAreaRect[0][1] + this.brightAreaRect[0][0] > this.canvasWidth && (this.brightAreaRect[0][0] = this.canvasWidth - this.brightAreaRect[0][1]);

        this.brightAreaRect[1][0] < 0 && (this.brightAreaRect[1][0] = 0);
        this.brightAreaRect[1][0] + this.brightAreaRect[1][1] > this.canvasHeight &&
            (this.brightAreaRect[1][0] = this.canvasHeight - this.brightAreaRect[1][1]);
    },
    regionalCorrection: function () {
        if (this.brightAreaRect[0][1] < 0) {
            this.brightAreaRect[0][0] = this.brightAreaRect[0][0] + this.brightAreaRect[0][1];
            this.brightAreaRect[0][1] = Math.abs(this.brightAreaRect[0][1]);
        }

        if (this.brightAreaRect[1][1] < 0) {
            this.brightAreaRect[1][0] = this.brightAreaRect[1][0] + this.brightAreaRect[1][1];
            this.brightAreaRect[1][1] = Math.abs(this.brightAreaRect[1][1]);
        }
    },
    fixedRectangle: function () {
        this.ctx.drawImage(this.img, -this.rangeMovement.left, -this.rangeMovement.top, this.imageWidth * this.ratio, this.imageHeight * this.ratio); // 绘制背景图片
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(0, 0, this.canvasWidth, this.canvasWidth);
        if (this.ctx.isPointInPath(this.offsetX, this.offsetY)) {
            this.isCapture &&
                (this.method = function (x, y) {
                    this.rangeMovement.left -= x - this.coordinatePoint[0];
                    this.rangeMovement.top -= y - this.coordinatePoint[1];
                    this.limitBoundary();
                });

            !this.isMousemove && (this.cursorValue.new = 'move');
        }
        this.ctx.closePath();
        this.ctx.restore();
    },
    regionZoom: function () {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = 'white';
        this.ctx.globalAlpha = 0.7;
        this.ctx.strokeStyle = '#4166f5';
        this.ctx.lineWidth = 3;
        this.ctx.moveTo(this.amplificationRange[0], this.canvasWidth * 0.94);
        this.ctx.lineTo(this.amplificationRange[1], this.canvasWidth * 0.94);
        this.ctx.stroke();
        this.ctx.closePath();
        this.ctx.restore();

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#4166f5';
        this.ctx.fillStyle = 'white';
        this.ctx.arc(this.amplificationRange[2], this.canvasWidth * 0.94, 5, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.stroke();
        if (this.ctx.isPointInPath(this.offsetX, this.offsetY)) {
            this.isCapture &&
                (this.method = function (x) {
                    var getProperty = this.imageWidth > this.imageHeight ? 'imageHeight' : 'imageWidth';
                    this.rangeMovement.left = (this.rangeMovement.left + (this[getProperty] * (1 - this.ratio)) / 2) / this.ratio;
                    this.rangeMovement.top = (this.rangeMovement.top + (this[getProperty] * (1 - this.ratio)) / 2) / this.ratio;

                    this.amplificationRange[2] = x;
                    if (this.amplificationRange[0] > x) this.amplificationRange[2] = this.amplificationRange[0];
                    if (this.amplificationRange[1] < x) this.amplificationRange[2] = this.amplificationRange[1];

                    this.ratio =
                        this.maximum * ((this.amplificationRange[2] - this.amplificationRange[0]) / (this.amplificationRange[1] - this.amplificationRange[0])) +
                        1;

                    this.rangeMovement.left = this.rangeMovement.left * this.ratio - (this[getProperty] * (1 - this.ratio)) / 2;
                    this.rangeMovement.top = this.rangeMovement.top * this.ratio - (this[getProperty] * (1 - this.ratio)) / 2;

                    this.rangeMovement.right = this.imageWidth * this.ratio - this.canvasWidth;
                    this.rangeMovement.bottom = this.imageHeight * this.ratio - this.canvasWidth;

                    this.limitBoundary();
                });
            !this.isMousemove && (this.cursorValue.new = 'w-resize');
        }
        this.ctx.closePath();
        this.ctx.restore();
    },
    limitBoundary: function () {
        if (this.rangeMovement.left < 0) this.rangeMovement.left = 0;
        if (this.rangeMovement.top < 0) this.rangeMovement.top = 0;

        if (this.rangeMovement.left > this.rangeMovement.right) this.rangeMovement.left = this.rangeMovement.right;
        if (this.rangeMovement.top > this.rangeMovement.bottom) this.rangeMovement.top = this.rangeMovement.bottom;
    },
    clipping: function () {
        // 裁剪图片
        if (this.unfixedBool) {
            !this.generateImgCtx && (this.generateImgCtx = document.createElement('canvas').getContext('2d'));

            this.generateImgCtx.canvas.width = this.brightAreaRect[0][1];
            this.generateImgCtx.canvas.height = this.brightAreaRect[1][1];
            this.generateImgCtx.drawImage(this.img, -this.brightAreaRect[0][0], -this.brightAreaRect[1][0], this.canvasWidth, this.canvasHeight);

            return this.generateImgCtx.canvas.toDataURL();
        }

        try {
            this.ctx.clearRect(-this.rangeMovement.left, -this.rangeMovement.top, this.imageWidth * this.ratio, this.imageHeight * this.ratio);
            this.fixedRectangle();
            return this.canvas.toDataURL();
        } finally {
            this.regionZoom();
        }
    },
    throttle: function () {
        this.draw();
        if (this.isThrottle) window.requestAnimationFrame(this.throttle.bind(this));
    },
    setCursor: function () {
        if (this.cursorValue.new !== this.cursorValue.old) {
            this.canvas.style.cursor = this.cursorValue.new;
            this.cursorValue.old = this.cursorValue.new;
        }
    },
    fitSize: function (style) {
        var styleWidth,
            styleHeight,
            imgWidth = this.img.width,
            imgHeight = this.img.height,
            rate;

        this.fixedBool && (styleWidth = style.width || this.canvasWidth);

        if (this.unfixedBool) {
            styleWidth = style.maxWidth;
            styleHeight = style.maxHeight;
        }

        if (styleWidth) {
            rate = styleWidth / imgWidth;
            imgWidth = styleWidth;
            imgHeight *= rate;
        }

        if (this.fixedBool && imgHeight < styleWidth) {
            rate = styleWidth / imgHeight;
            imgWidth *= rate;
            imgHeight = styleWidth;
        }

        if (this.unfixedBool && styleHeight) {
            if (!rate) {
                rate = styleHeight / imgHeight;
                imgHeight = styleHeight;
                imgWidth = imgWidth * rate;
            }
            if (imgHeight > styleHeight) {
                rate = styleHeight / imgHeight;
                imgHeight = Math.ceil(rate * imgHeight);
            }
            styleWidth > styleHeight && (imgWidth = imgWidth * rate);
        }

        if (this.unfixedBool) {
            this.canvasWidth = this.canvas.width = imgWidth;
            this.canvasHeight = this.canvas.height = imgHeight;

            // 初始化高亮区域的位置和大小
            this.brightAreaRect = [
                [(this.canvasWidth - this.canvasWidth / 3) / 2, this.canvasWidth / 3],
                [(this.canvasHeight - this.canvasWidth / 3) / 2, this.canvasWidth / 3],
            ];
        }

        if (this.fixedBool) {
            this.canvasWidth = this.canvas.width = this.canvas.height = styleWidth;
            this.imageWidth = imgWidth;
            this.imageHeight = imgHeight;

            this.rangeMovement = {
                top: 0,
                left: 0,
                right: this.imageWidth - styleWidth,
                bottom: this.imageHeight - styleWidth,
            };
            this.amplificationRange = [
                (this.canvasWidth - this.canvasWidth * 0.9) / 2,
                (this.canvasWidth - this.canvasWidth * 0.9) / 2 + this.canvasWidth * 0.9,
            ];
            this.amplificationRange[2] = this.amplificationRange[0];

            this.maximum = (+style.maximum === +style.maximum ? +style.maximum : this.maximum || 6) - 1;
            this.ratio = 1;
        }
    },
    replaceImg(img, style) {
        this.img = img;
        this.fitSize(style || {});
        this.draw();
    },
};

window.ImageCropping = ImageCropping;
