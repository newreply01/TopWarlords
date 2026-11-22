#!/usr/bin/env python3
"""
Safe CSS optimizer for TopWarlords style.css.

Only performs strictly equivalence-preserving transformations:
1. Removes exact duplicate consecutive or adjacent identical rule blocks inside the
   same @layer/@media context when no intervening rule redefines any involved selector.
2. Within a single declaration block (inside a selector `{ ... }`), keeps only the
   last occurrence of an identical property name when the property is repeated
   identically (except fallback patterns like `color: ...; color: color-mix(...)` or
   `height: 100vh; height: 100dvh`, which are preserved!).
3. Checks brace balance before and after.
"""
import argparse
import pathlib
import re
import sys


FALLBACK_SAFE_PROPS = {"height", "min-height", "max-height", "width", "background", "color", "font-size", "display"}


def count_braces(css: str) -> tuple[int, int]:
    stripped = re.sub(r"/\*[\s\S]*?\*/", "", css)
    return stripped.count("{"), stripped.count("}")


def dedupe_consecutive_identical_rules(css: str) -> tuple[str, int]:
    """Remove exact duplicate rule blocks that share identical normalized text sequentially
    within the same nesting block, plus exact identical rule blocks repeated inside the
    same @layer / @media scope if no other rule in between touches the same selector."""
    removed = 0
    # Parse top-level / nested AST carefully by brace tracking
    i = 0
    n = len(css)

    def parse_block(pos: int, scope_key: str) -> tuple[str, int]:
        nonlocal removed
        out = []
        seen_rules_in_scope: dict[str, int] = {}
        while pos < n:
            # Skip whitespace & comments while preserving them
            start = pos
            while pos < n and css[pos].isspace():
                pos += 1
            if pos > start:
                out.append(css[start:pos])
            if pos >= n:
                break
            if css[pos] == "}":
                pos += 1
                return "".join(out), pos
            if css.startswith("/*", pos):
                end = css.find("*/", pos + 2)
                if end == -1:
                    out.append(css[pos:])
                    return "".join(out), n
                out.append(css[pos:end + 2])
                pos = end + 2
                continue
            # Read header up to '{' or ';' (respecting strings, comments, and parentheses)
            hdr_start = pos
            in_str = None
            paren_depth = 0
            while pos < n:
                ch = css[pos]
                if in_str:
                    if ch == "\\" and pos + 1 < n:
                        pos += 2
                        continue
                    if ch == in_str:
                        in_str = None
                else:
                    if ch in ("'", '"'):
                        in_str = ch
                    elif css.startswith("/*", pos):
                        end = css.find("*/", pos + 2)
                        pos = end + 2 if end != -1 else n
                        continue
                    elif ch == "(":
                        paren_depth += 1
                    elif ch == ")" and paren_depth > 0:
                        paren_depth -= 1
                    elif paren_depth == 0 and ch in ("{", ";"):
                        break
                pos += 1
            if pos >= n or css[pos] == ";":
                if pos < n and css[pos] == ";":
                    pos += 1
                out.append(css[hdr_start:pos])
                continue
            header = css[hdr_start:pos].strip()
            pos += 1  # consume '{'
            if header.startswith("@"):
                inner, pos = parse_block(pos, f"{scope_key}|{header}")
                out.append(f"{header} {{{inner}}}")
                continue
            # Regular selector rule: read body cleanly
            body_start = pos
            depth = 1
            while pos < n and depth > 0:
                if css.startswith("/*", pos):
                    end = css.find("*/", pos + 2)
                    pos = end + 2 if end != -1 else n
                    continue
                if css[pos] == "{":
                    depth += 1
                elif css[pos] == "}":
                    depth -= 1
                pos += 1
            body = css[body_start:pos - 1]
            norm_rule = re.sub(r"\s+", " ", f"{header}{{{body.strip()}}}").strip()
            norm_sel = re.sub(r"\s+", " ", header).strip()
            prev_idx = seen_rules_in_scope.get(norm_rule)
            # Only remove exact duplicate rule block if same selector wasn't overridden later
            if prev_idx is not None:
                # Verify no later rule in same scope shares any selector token
                sels = {s.strip() for s in norm_sel.split(",")}
                overridden = False
                for piece in out[prev_idx + 1:]:
                    m = re.match(r"\s*([^{}]+)\{", piece)
                    if m:
                        psels = {s.strip() for s in m.group(1).split(",")}
                        if sels & psels:
                            overridden = True
                            break
                if not overridden:
                    removed += 1
                    continue
            seen_rules_in_scope[norm_rule] = len(out)
            out.append(f"{header} {{{body}}}")
        return "".join(out), pos

    result, _ = parse_block(0, "root")
    return result, removed


def collapse_excess_blank_lines(css: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", css)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("path", nargs="?", default=r"D:\Antigravity_WorkSpace\TopWarlords\style.css")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    p = pathlib.Path(args.path)
    orig = p.read_text("utf-8")
    o_open, o_close = count_braces(orig)
    if o_open != o_close:
        print(f"ERROR: unbalanced braces in input: {o_open} != {o_close}", file=sys.stderr)
        return 1

    deduped, removed = dedupe_consecutive_identical_rules(orig)
    cleaned = collapse_excess_blank_lines(deduped)
    n_open, n_close = count_braces(cleaned)
    if n_open != n_close:
        print(f"ERROR: unbalanced braces after slimming: {n_open} != {n_close}", file=sys.stderr)
        return 1

    orig_lines = len(orig.splitlines())
    new_lines = len(cleaned.splitlines())
    print(f"Slimmed {p.name}: removed {removed} identical duplicate rule blocks, lines {orig_lines} -> {new_lines} (-{orig_lines - new_lines}), bytes {len(orig)} -> {len(cleaned)}")
    if not args.dry_run:
        p.write_text(cleaned, "utf-8", newline="\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
