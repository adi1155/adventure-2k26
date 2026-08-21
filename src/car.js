function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function trap(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

export function makeCarIcon() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.translate(size / 2, size / 2 + 6);
  ctx.scale(1.12, 1.12);

  ctx.save();
  ctx.filter = "blur(10px)";
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.beginPath();
  ctx.ellipse(8, 40, 42, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const wheel = (x, y, w, h) => {
    ctx.save();
    ctx.fillStyle = "#0c0a08";
    rr(ctx, x, y, w, h, 5);
    ctx.fill();
    ctx.fillStyle = "#3a342c";
    rr(ctx, x + 3, y + 4, w - 6, h - 8, 3);
    ctx.fill();
    ctx.fillStyle = "#d8b36a";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, 4.2, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a140c";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, 1.6, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  wheel(-38, -22, 14, 28);
  wheel(24, -22, 14, 28);
  wheel(-40, 18, 15, 30);
  wheel(25, 18, 15, 30);

  const side = ctx.createLinearGradient(22, 0, 46, 8);
  side.addColorStop(0, "#c4923a");
  side.addColorStop(1, "#6d4714");
  ctx.fillStyle = side;
  trap(ctx, [
    [22, -58],
    [38, -42],
    [40, 36],
    [24, 58],
  ]);
  ctx.fill();

  const rear = ctx.createLinearGradient(-28, 52, 28, 70);
  rear.addColorStop(0, "#a56d24");
  rear.addColorStop(0.5, "#d4a24a");
  rear.addColorStop(1, "#7a5216");
  ctx.fillStyle = rear;
  trap(ctx, [
    [-24, 58],
    [24, 58],
    [22, 70],
    [-22, 70],
  ]);
  ctx.fill();

  const body = ctx.createLinearGradient(-36, 0, 36, 0);
  body.addColorStop(0, "#8d5c18");
  body.addColorStop(0.22, "#e0b45c");
  body.addColorStop(0.5, "#fff1c8");
  body.addColorStop(0.78, "#e8c47a");
  body.addColorStop(1, "#9a641c");
  ctx.fillStyle = body;
  trap(ctx, [
    [-24, -62],
    [22, -62],
    [26, 58],
    [-28, 58],
  ]);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 248, 230, 0.55)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = "#b47a28";
  trap(ctx, [
    [-18, -62],
    [16, -62],
    [18, -44],
    [-20, -44],
  ]);
  ctx.fill();

  const hood = ctx.createLinearGradient(0, -62, 0, -28);
  hood.addColorStop(0, "#f7e2a8");
  hood.addColorStop(1, "#c99236");
  ctx.fillStyle = hood;
  trap(ctx, [
    [-18, -58],
    [16, -58],
    [19, -26],
    [-21, -26],
  ]);
  ctx.fill();

  ctx.strokeStyle = "rgba(90, 55, 12, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -56);
  ctx.lineTo(0, -28);
  ctx.stroke();

  ctx.fillStyle = "#efe0b0";
  ctx.beginPath();
  ctx.ellipse(-12, -60, 5.5, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(10, -60, 5.5, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.beginPath();
  ctx.ellipse(-12, -60, 3.2, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(10, -60, 3.2, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1c1610";
  trap(ctx, [
    [-16, -26],
    [15, -26],
    [18, -4],
    [-19, -4],
  ]);
  ctx.fill();

  const glass = ctx.createLinearGradient(-10, -26, 20, 0);
  glass.addColorStop(0, "rgba(186, 214, 232, 0.55)");
  glass.addColorStop(0.45, "rgba(40, 70, 92, 0.72)");
  glass.addColorStop(1, "rgba(18, 28, 38, 0.85)");
  ctx.fillStyle = glass;
  trap(ctx, [
    [-14, -24],
    [13, -24],
    [16, -6],
    [-17, -6],
  ]);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  trap(ctx, [
    [-10, -22],
    [-2, -22],
    [0, -8],
    [-12, -8],
  ]);
  ctx.fill();

  const roof = ctx.createLinearGradient(-18, 0, 18, 24);
  roof.addColorStop(0, "#c4892c");
  roof.addColorStop(0.45, "#f0d08a");
  roof.addColorStop(1, "#a56d22");
  ctx.fillStyle = roof;
  trap(ctx, [
    [-19, -4],
    [18, -4],
    [20, 28],
    [-22, 28],
  ]);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  trap(ctx, [
    [-12, 0],
    [4, 0],
    [6, 22],
    [-10, 22],
  ]);
  ctx.fill();

  ctx.fillStyle = "#1c1610";
  trap(ctx, [
    [-22, 28],
    [20, 28],
    [22, 46],
    [-24, 46],
  ]);
  ctx.fill();
  ctx.fillStyle = "rgba(70, 110, 130, 0.45)";
  trap(ctx, [
    [-18, 30],
    [16, 30],
    [18, 44],
    [-20, 44],
  ]);
  ctx.fill();

  ctx.fillStyle = "#9a2a18";
  ctx.beginPath();
  ctx.ellipse(-14, 62, 5, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(12, 62, 5, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#5a3a12";
  rr(ctx, -8, 48, 16, 6, 2);
  ctx.fill();

  ctx.fillStyle = "#2a2116";
  trap(ctx, [
    [-34, -8],
    [-24, -6],
    [-24, 2],
    [-34, 0],
  ]);
  ctx.fill();
  trap(ctx, [
    [22, -6],
    [33, -8],
    [33, 0],
    [22, 2],
  ]);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 244, 214, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-22, -40);
  ctx.lineTo(-26, 50);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(18, -40);
  ctx.lineTo(23, 50);
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}
