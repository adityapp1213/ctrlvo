import React from "react";

type NodeProps = React.HTMLAttributes<HTMLDivElement>;

export function Node(props: NodeProps) {
  return <div {...props} />;
}

Node.displayName = "Node";
