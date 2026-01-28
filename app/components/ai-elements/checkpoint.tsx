import React from "react";

type CheckpointProps = React.HTMLAttributes<HTMLDivElement>;

export function Checkpoint(props: CheckpointProps) {
  return <div {...props} />;
}

Checkpoint.displayName = "Checkpoint";
