import { r as StarDust } from "./StarDust-CGxkT9aq.js";
import { useEffect, useRef } from "react";
import { jsx } from "react/jsx-runtime";
// src/lib/react.tsx
/** React wrapper around the framework-agnostic `StarDust` engine. */
function DustCanvas({ activeText, isFreeDrift, scatterVersion = 0, activityVersion, fill, className, style, "aria-label": ariaLabel = "Interactive dust particle canvas", engineRef, ...rest }) {
	const canvasRef = useRef(null);
	const engine = useRef(null);
	const options = {
		...rest,
		text: activeText,
		freeDrift: isFreeDrift
	};
	const optionsRef = useRef(options);
	optionsRef.current = options;
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const instance = new StarDust(canvas, {
			...optionsRef.current,
			fill
		});
		engine.current = instance;
		engineRef?.(instance);
		return () => {
			instance.destroy();
			engine.current = null;
			engineRef?.(null);
		};
	}, []);
	useEffect(() => {
		engine.current?.setOptions(optionsRef.current);
	});
	useEffect(() => {
		engine.current?.markActivity();
	}, [activityVersion]);
	useEffect(() => {
		if (scatterVersion === 0) return;
		engine.current?.scatter();
	}, [scatterVersion]);
	return /* @__PURE__ */ jsx("canvas", {
		ref: canvasRef,
		"aria-label": ariaLabel,
		className,
		style
	});
}
export { DustCanvas, StarDust };

//# sourceMappingURL=react.js.map