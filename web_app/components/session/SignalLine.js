"import client";
import { useEffect, useRef } from "react";

const SignalLine = ({
  width = 300,
  height = 50,
  lineColor = "#ed1c23",
  jitterAmplitude = 5,
  baseLinePosition = 0.5,
  secondLineColor = "#FFFFFF",
  secondLineAmplitude = 10,
  secondLineFrequency = 0.05,
  secondLineBasePosition = 0.7,
}) => {
  const signalLineRef = useRef(null);

  useEffect(() => {
    const canvas = signalLineRef.current;
    const ctx = canvas.getContext("2d");
    let animationFrameId;
    let lastTime = 0;

    const baseLine1 = canvas.height * baseLinePosition;
    const baseLine2 = canvas.height * secondLineBasePosition;

    const drawSignalLine = (time) => {
      const deltaTime = time - lastTime;
      lastTime = time;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.beginPath();
      ctx.moveTo(0, baseLine1);
      for (let x = 0; x < canvas.width; x++) {
        const jitter = Math.random() * jitterAmplitude - jitterAmplitude / 2;
        const y = baseLine1 + jitter;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, baseLine2);
      for (let x = 0; x < canvas.width; x++) {
        const y =
          baseLine2 +
          secondLineAmplitude *
            Math.sin((x + deltaTime * 0.1) * secondLineFrequency);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = secondLineColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      animationFrameId = requestAnimationFrame(drawSignalLine);
    };

    animationFrameId = requestAnimationFrame(drawSignalLine);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    jitterAmplitude,
    baseLinePosition,
    lineColor,
    secondLineAmplitude,
    secondLineFrequency,
    secondLineBasePosition,
    secondLineColor,
  ]);

  return <canvas ref={signalLineRef} width={width} height={height} />;
};

export default SignalLine;
