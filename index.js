/* eslint-disable no-param-reassign */
/**
 * @typedef {import('hast').Root} Root
 * @typedef {import('twemoji').ParseObject & { framework?: string; exclude?: Array<string>; params: { [key: string]: string | number; } }} Options
 * @typedef {(options: void | Options; ch: string) => string} Converter
 * @typedef {(params: { [key: string]: string | number; }) => string} Squasher
 */
import emojiRegex from 'emoji-regex';
import GraphemeSplitter from 'grapheme-splitter';
import twemoji from 'twemoji';
import { map } from 'unist-util-map';

const regex = emojiRegex();
const splitter = new GraphemeSplitter();

const BASE_URL = 'https://twemoji.maxcdn.com/v/latest';
const BASE_SIZE = '72x72';
const BASE_EXT = '.png';

/**
 * Squash parameters
 *
 * @type {Converter}
 */
const squasher = (params) => {
  let _params = new URLSearchParams();
  for (const key in params) {
    _params.append(key, params[key].toString());
  }
  return _params.toString();
};

/**
 * Base converter.
 *
 * @type {Converter}
 */
const base = (options, ch) =>
  `${(options && options.base) ?? BASE_URL}/${
    (options && options.folder) ?? (options && options.size) ?? BASE_SIZE
  }/${twemoji.convert.toCodePoint(ch)}${(options && options.ext) ?? BASE_EXT}`;

/**
 * Convert options to `src` url.
 *
 * @type {Converter}
 */
const frameworkURL = (options, ch) => {
  if (!options || (options && !options.framework)) return base(options, ch);
  const framework = options.framework;

  switch (framework) {
    case 'next':
      if (options.params) {
        options.params.w = options.params.w || '64';
        options.params.q = options.params.q || '30';
      } else {
        options.params = { w: '64', q: '30' };
      }
      return `/_next/image?url=${base(options, ch)}&${squasher(options.params)}`;
    default:
      // your framework isn't supported yet...
      return base(options, ch);
  }
};

/**
 * Plugin to twemoji-fy ordinary emojis in HTML.
 *
 * @type {import('unified').Plugin<[Options?]|void[], Root>}
 */
export default function rehypeTwemojify(options) {
  const exclude = (options && options.exclude) ?? [];
  return (tree) =>
    map(tree, (node) => {
      if (node.type !== 'text' || !regex.test(node.value)) {
        return node;
      }

      let c = [],
        s = '';
      for (const ch of splitter.splitGraphemes(node.value)) {
        // console.log(ch + ': ' + (!ch.match(regex) || exclude.indexOf(ch) !== -1));
        if (!ch.match(regex) || exclude.indexOf(ch) !== -1) {
          s += ch;
        } else {
          c.push({
            type: 'text',
            value: s
          });
          s = '';

          c.push({
            type: 'element',
            tagName: 'img',
            properties: {
              className: [(options && options.className) ?? 'emoji'],
              draggable: 'false',
              alt: ch,
              decoding: 'async',
              src: frameworkURL(options, ch)
            },
            children: []
          });
        }
      }

      if (s !== '') {
        c.push({
          type: 'text',
          value: s
        });
        s = '';
      }

      return {
        type: 'element',
        tagName: 'span',
        children: c
      };
    });
}
