import { createElement, type ReactNode } from "react";

const allowedTags = new Set([
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "a",
  "code",
  "mark",
  "span",
  "br",
]);

const mapNode = (node: ChildNode, key: string): ReactNode => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  const children = Array.from(element.childNodes).map((child, index) =>
    mapNode(child, `${key}-${index}`),
  );

  if (!allowedTags.has(tag)) {
    return createElement("span", { key }, children);
  }

  if (tag === "a") {
    const href = element.getAttribute("href") ?? "#";
    return createElement(
      "a",
      {
        key,
        href,
        target: "_blank",
        rel: "noreferrer noopener",
      },
      children,
    );
  }

  if (tag === "br") {
    return createElement("br", { key });
  }

  if (tag === "span") {
    const color = element.style.color;
    const backgroundColor = element.style.backgroundColor;
    const borderRadius = element.style.borderRadius;
    const padding = element.style.padding;
    const boxDecorationBreak = element.style.boxDecorationBreak;
    const style =
      color || backgroundColor
        ? {
            ...(color ? { color } : {}),
            ...(backgroundColor ? { backgroundColor } : {}),
            ...(borderRadius ? { borderRadius } : {}),
            ...(padding ? { padding } : {}),
            ...(boxDecorationBreak
              ? {
                  boxDecorationBreak,
                  WebkitBoxDecorationBreak: boxDecorationBreak,
                }
              : {}),
          }
        : undefined;
    return createElement("span", { key, style }, children);
  }

  return createElement(tag, { key }, children);
};

export const renderInlineHtml = (html: string): ReactNode[] => {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const nodes = Array.from(document.body.childNodes);
  return nodes.map((node, index) => mapNode(node, `node-${index}`));
};
