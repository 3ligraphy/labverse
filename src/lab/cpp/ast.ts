/** Syntax tree of the course's C++ subset. Every node keeps its line (and column) for errors and the stepper. */
export type TypeName = 'int' | 'long' | 'short' | 'unsigned' | 'float' | 'double' | 'char' | 'bool' | 'string' | 'size_t' | 'void' | 'auto';
export type VarType = { base: TypeName; isConst: boolean };

type Pos = { line: number; col: number };

export type Expr = Pos & (
  | { k: 'int'; v: number; long?: boolean; text: string }
  | { k: 'float'; v: number; single?: boolean; text: string }
  | { k: 'char'; v: number; text: string }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'name'; name: string; qualified?: string }
  | { k: 'unary'; op: '-' | '+' | '!' | 'pre++' | 'pre--' | 'post++' | 'post--'; e: Expr }
  | { k: 'binary'; op: string; a: Expr; b: Expr }
  | { k: 'assign'; op: string; target: Expr; value: Expr }
  | { k: 'ternary'; cond: Expr; a: Expr; b: Expr }
  | { k: 'call'; name: string; args: Expr[]; qualified?: string }
  | { k: 'method'; obj: Expr; name: string; args: Expr[] }
  | { k: 'index'; obj: Expr; index: Expr }
  | { k: 'cast'; to: TypeName; e: Expr; style: 'c' | 'static' | 'func' }
  | { k: 'npos' }
);

export type Declarator = Pos & { name: string; init: Expr | null };

export type Stmt = Pos & (
  | { k: 'block'; body: Stmt[]; endLine: number }
  | { k: 'decl'; type: VarType; vars: Declarator[] }
  | { k: 'expr'; e: Expr }
  | { k: 'if'; cond: Expr; then: Stmt; else: Stmt | null }
  | { k: 'while'; cond: Expr; body: Stmt }
  | { k: 'do'; body: Stmt; cond: Expr }
  | { k: 'for'; init: Stmt | null; cond: Expr | null; step: Expr | null; body: Stmt }
  | { k: 'return'; e: Expr | null }
  | { k: 'break' }
  | { k: 'continue' }
  | { k: 'empty' }
);

export type Program = {
  includes: { name: string; line: number }[];
  usingStd: boolean;
  globals: Stmt[];
  main: Extract<Stmt, { k: 'block' }> | null;
  mainLine: number;
  voidMain: boolean;
};
