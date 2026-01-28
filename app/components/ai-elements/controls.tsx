import React from "react";

type ControlsProps = React.HTMLAttributes<HTMLDivElement>;

export function Controls(props: ControlsProps) {
  return <div {...props} />;
}

Controls.displayName = "Controls";
