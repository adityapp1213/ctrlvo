import React from "react";

type ContextProps = React.HTMLAttributes<HTMLDivElement>;

export function Context(props: ContextProps) {
  return <div {...props} />;
}

Context.displayName = "Context";
