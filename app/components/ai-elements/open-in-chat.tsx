import React from "react";

type OpenInChatProps = React.HTMLAttributes<HTMLDivElement>;

export function OpenInChat(props: OpenInChatProps) {
  return <div {...props} />;
}

OpenInChat.displayName = "OpenInChat";
