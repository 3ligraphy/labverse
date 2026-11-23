/**
 * react-native-svg in the browser preview: each component draws the real SVG element (the preview is a web page),
 * so icons, charts and illustrations made with <Svg>, <Path>, <Circle>… look as they do on a phone.
 * Props keep their react-native-svg names (strokeWidth, fillOpacity…: React writes them as SVG attributes);
 * onPress becomes a click, and style arrays are flattened.
 */
import { createElement, forwardRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native-web';

type AnyProps = Record<string, any> & { children?: ReactNode };

/** react-native-svg props → SVG element props. */
function domProps(props: AnyProps, tag: string): AnyProps {
  const { onPress, style, testID, accessibilityLabel, ...rest } = props;
  const out: AnyProps = { ...rest };
  if (onPress) out.onClick = onPress;
  if (style) out.style = StyleSheet.flatten(style);
  if (testID) out['data-testid'] = testID;
  if (accessibilityLabel) out['aria-label'] = accessibilityLabel;
  // <Text> of react-native-svg: fontSize / fontWeight / textAnchor are attributes in SVG too
  if (tag === 'svg') {
    out.xmlns = 'http://www.w3.org/2000/svg';
    if (out.width === undefined && out.height === undefined && !out.style?.width) out.width = '100%';
  }
  return out;
}

function svgComponent(tag: string, name: string) {
  const C = forwardRef<unknown, AnyProps>((props, ref) => createElement(tag, { ...domProps(props, tag), ref }, props.children));
  C.displayName = name;
  return C;
}

const TAGS = {
  Svg: 'svg', Circle: 'circle', Ellipse: 'ellipse', G: 'g', Text: 'text', TSpan: 'tspan', TextPath: 'textPath', Path: 'path',
  Polygon: 'polygon', Polyline: 'polyline', Line: 'line', Rect: 'rect', Use: 'use', Image: 'image', Symbol: 'symbol', Defs: 'defs',
  LinearGradient: 'linearGradient', RadialGradient: 'radialGradient', Stop: 'stop', ClipPath: 'clipPath', Pattern: 'pattern',
  Mask: 'mask', Marker: 'marker', ForeignObject: 'foreignObject',
} as const;

const components = Object.fromEntries(Object.entries(TAGS).map(([name, tag]) => [name, svgComponent(tag, name)])) as Record<keyof typeof TAGS, ReturnType<typeof svgComponent>>;

/** The module students import: `import Svg, { Path } from 'react-native-svg'`. */
export const SvgModule = {
  default: components.Svg,
  ...components,
  // SvgXml / SvgUri: the markup or the file drawn as it is
  SvgXml: ({ xml, width, height, style }: AnyProps) => createElement('span', { style: { display: 'inline-flex', width, height, ...StyleSheet.flatten(style) }, dangerouslySetInnerHTML: { __html: String(xml ?? '') } }),
  SvgUri: ({ uri, width, height, style }: AnyProps) => createElement('img', { src: uri, width, height, style: StyleSheet.flatten(style), alt: '' }),
};
