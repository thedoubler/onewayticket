import React, { CSSProperties, ReactNode, HTMLAttributes } from "react";

type AnimationMode = "auto-rotate" | "rotate-on-hover" | "stop-rotate-on-hover";

interface BorderRotateProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  children: ReactNode;
  className?: string;

  // Animation customization
  animationMode?: AnimationMode;
  animationSpeed?: number; // Duration in seconds

  // Color customization
  gradientColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  backgroundColor?: string;

  // Border customization
  borderWidth?: number;
  borderRadius?: number;

  // Container styling
  style?: CSSProperties;
}

const defaultGradientColors = {
  primary: "#584827",
  secondary: "#c7a03c",
  accent: "#f9de90",
};

const BorderRotate: React.FC<BorderRotateProps> = ({
  children,
  className = "",
  animationMode = "auto-rotate",
  animationSpeed = 5,
  gradientColors = defaultGradientColors,
  backgroundColor = "#2d230f",
  borderWidth = 2,
  borderRadius = 20,
  style = {},
  ...props
}) => {
  // Get animation class based on mode
  const getAnimationClass = () => {
    switch (animationMode) {
      case "auto-rotate":
        return "gradient-border-auto";
      case "rotate-on-hover":
        return "gradient-border-hover";
      case "stop-rotate-on-hover":
        return "gradient-border-stop-hover";
      default:
        return "";
    }
  };

  const containerStyle: CSSProperties = {
    position: "relative",
    borderRadius: `${borderRadius}px`,
    padding: `${borderWidth}px`,
    ...style,
  } as CSSProperties;

  const borderStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    "--angle": "0deg",
    "--animation-duration": `${animationSpeed}s`,
    borderRadius: `${borderRadius}px`,
    background: `conic-gradient(from var(--angle), ${gradientColors.primary}, ${gradientColors.secondary}, ${gradientColors.accent}, ${gradientColors.secondary}, ${gradientColors.primary})`,
    WebkitMask: `linear-gradient(#f8f8f8 0 0) content-box, linear-gradient(#f8f8f8 0 0)`,
    WebkitMaskComposite: "xor",
    maskComposite: "exclude",
    padding: `${borderWidth}px`,
  } as CSSProperties;

  const innerStyle: CSSProperties = {
    background: backgroundColor,
    borderRadius: `${borderRadius - borderWidth}px`,
    width: "100%",
    height: "100%",
    position: "relative",
    zIndex: 1,
  } as CSSProperties;

  return (
    <div
      className={`gradient-border-component ${getAnimationClass()} ${className}`}
      style={containerStyle}
      {...props}
    >
      <div className="gradient-border-rotator" style={borderStyle} />
      <div style={innerStyle}>{children}</div>
    </div>
  );
};

export { BorderRotate };
