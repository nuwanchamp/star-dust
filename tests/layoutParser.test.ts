import { describe, expect, test } from 'bun:test';
import { collectLayoutImageRefs, parseLayoutMarkup } from '../src/engine/layoutParser';

describe('parseLayoutMarkup', () => {
  test('parses a nested layout', () => {
    const { root, error } = parseLayoutMarkup(
      `<Col gap="12"><Heading size="lg">Hi</Heading><Text>Body</Text><Button action="go">Go</Button></Col>`
    );
    expect(error).toBeNull();
    expect(root?.tag).toBe('Col');
    expect(root?.children.map((c) => c.tag)).toEqual(['Heading', 'Text', 'Button']);
    expect(root?.children[2].attrs.action).toBe('go');
  });

  test('accepts tag aliases', () => {
    const { root } = parseLayoutMarkup(`<VStack><H1>Title</H1><P>Para</P></VStack>`);
    expect(root?.tag).toBe('Col');
    expect(root?.children.map((c) => c.tag)).toEqual(['Heading', 'Text']);
  });

  test('reports an error for empty markup', () => {
    const { root, error } = parseLayoutMarkup('   ');
    expect(root).toBeNull();
    expect(error?.line).toBe(1);
  });

  test('collects image refs (empty string for an Image without src)', () => {
    const { root } = parseLayoutMarkup(`<Row><Image src="logo" /><Image /><Image src="logo" /></Row>`);
    expect(collectLayoutImageRefs(root).sort()).toEqual(['', 'logo']);
  });
});
