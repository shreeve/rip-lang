// 16-enums.ts — Enum declarations and exhaustiveness

// Numeric enum (auto-incrementing)
enum Direction {
  North,
  South,
  East,
  West,
}

// String-valued enum
enum Color {
  Red = 'red',
  Green = 'green',
  Blue = 'blue',
}

// Mixed use in typed functions
function move(dir: Direction): string {
  switch (dir) {
    case Direction.North: return 'up'
    case Direction.South: return 'down'
    case Direction.East: return 'right'
    case Direction.West: return 'left'
  }
}

function colorName(c: Color): string {
  switch (c) {
    case Color.Red: return 'Red'
    case Color.Green: return 'Green'
    case Color.Blue: return 'Blue'
  }
}

// Exercise
console.log('move(North):', move(Direction.North))
console.log('move(West):', move(Direction.West))
console.log('Color.Red:', Color.Red)
console.log('colorName(Blue):', colorName(Color.Blue))
