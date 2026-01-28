import React from "react";

type PanelProps = React.HTMLAttributes<HTMLDivElement>;

export function Panel(props: PanelProps) {
  return <div {...props} />;
}

Panel.displayName = "Panel";
