import React from "react";

type EdgeProps = React.HTMLAttributes<HTMLDivElement>;

export function Edge(props: EdgeProps) {
  return <div {...props} />;
}

Edge.displayName = "Edge";
