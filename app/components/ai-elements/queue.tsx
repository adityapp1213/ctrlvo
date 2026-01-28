import React from "react";

type QueueProps = React.HTMLAttributes<HTMLDivElement>;

export function Queue(props: QueueProps) {
  return <div {...props} />;
}

Queue.displayName = "Queue";
