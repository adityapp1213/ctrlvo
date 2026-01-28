import React from "react";

type ConnectionProps = React.HTMLAttributes<HTMLDivElement>;

export function Connection(props: ConnectionProps) {
  return <div {...props} />;
}

Connection.displayName = "Connection";
