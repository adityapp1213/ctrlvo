import React from "react";

type ToolbarProps = React.HTMLAttributes<HTMLDivElement>;

export function Toolbar(props: ToolbarProps) {
  return <div {...props} />;
}

Toolbar.displayName = "Toolbar";
