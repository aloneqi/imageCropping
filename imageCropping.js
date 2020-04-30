var ImageCropping = function (deploy) {
    this.canvas = deploy.canvas;
    this.img = deploy.img;
    this.fitSize(deploy.maxWidth, deploy.maxHeight);
    this.init();
};
ImageCropping.prototype = {
    init: function () {
        this.ctx = this.canvas.getContext('2d');
        this.isMousemove = false; // 捕获绘制区域的方法或光标 值是true时捕获方法，是false时捕获光标
        this.isMouseover = false;
        this.isThrottle = false; // 是否开启帧循环
        this.cursorValue = { old: 'auto', new: 'auto' }; // 记录新旧光标值
        this.zoomPointArr = [0, 0, 1, 0, 2, 0, 2, 1, 2, 2, 1, 2, 0, 2, 0, 1]; // 8个拖拽点坐标
        this.resizeArr = ['nw-resize', 'n-resize', 'ne-resize', 'e-resize', 'se-resize', 's-resize', 'sw-resize', 'w-resize']; // 8个方向光标
        this.coordinatePoint = []; // 记录上一个点的坐标位置
        this.lineDash = [5, 5]; // 虚线间隔宽度
        this.borderWidth = 2; // 边框宽度

        // 初始化高亮区域的位置和大小
        this.brightAreaRect = [
            [(this.canvasWidth - this.canvasWidth / 3) / 2, this.canvasWidth / 3],
            [(this.canvasHeight - this.canvasWidth / 3) / 2, this.canvasWidth / 3],
        ];

        this.canvas.onmouseover = function () {
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
            if (this.isThrottle) return this.draw();
            this.isThrottle = true;
            this.throttle(this.isThrottle);
        }.bind(this);

        this.canvas.onmousemove = function (e) {
            this.offsetX = e.offsetX;
            this.offsetY = e.offsetY;
            if (this.isMousemove) {
                this.isCapture && (this.isCapture = !this.isCapture);
            } else {
                this.cursorValue.new = 'auto'; // 初始化坐标值
            }
        }.bind(this);

        this.canvas.onmouseout = this.canvas.onmouseup = function (e) {
            // 这个判断暂时没用，这是为了将来可能兼容web端而做准备，填坑靠缘分
            if (!this.isMouseover || e.type === 'mouseout') {
                this.isThrottle = false;
                this.isMouseover && (this.isMouseover = false);
            }
            this.isMousemove = false;
            this.isCapture = false;
            this.method = void 0;

            // 当高亮区域反转时宽高是负数，所以重新校正位置和大小
            this.regionalCorrection();
        }.bind(this);

        this.draw();
    },
    draw: function () {
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.method && this.method.call(this, this.offsetX, this.offsetY); // 运行已捕获得到的方法
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
    clipping: function () {
        // 裁剪图片
        !this.generateImgCtx && (this.generateImgCtx = document.createElement('canvas').getContext('2d'));

        this.generateImgCtx.canvas.width = Math.abs(this.brightAreaRect[0][1]);
        this.generateImgCtx.canvas.height = Math.abs(this.brightAreaRect[1][1]);
        this.generateImgCtx.drawImage(
            this.img,
            -Math.min(this.brightAreaRect[0][0] + this.brightAreaRect[0][1], this.brightAreaRect[0][0]),
            -Math.min(this.brightAreaRect[1][0] + this.brightAreaRect[1][1], this.brightAreaRect[1][0]),
            this.canvasWidth,
            this.canvasHeight
        );

        return this.generateImgCtx.canvas.toDataURL();
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
    fitSize: function (maxWidth, maxHeight) {
        var width = this.img.width,
            height = this.img.height,
            rate;

        if (maxWidth) {
            rate = maxWidth / width;
            width = maxWidth;
            height = height * rate;
        }

        if (maxHeight) {
            if (!rate) {
                rate = maxHeight / height;
                height = maxHeight;
                width = width * rate;
            }
            if (height > maxHeight) {
                rate = maxHeight / height;
                height = Math.ceil(rate * height);
            }
            maxWidth > maxHeight && (width = width * rate);
        }

        this.canvasWidth = this.canvas.width = width;
        this.canvasHeight = this.canvas.height = height;
    },
};

window.ImageCropping = ImageCropping;
