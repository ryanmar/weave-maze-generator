import { Maze } from './Maze';
import { Cell } from './Cell';
import { Node } from './Node';
import { permutations } from '../utils/arrays';
import { Entropy } from '../utils/Entropy';

/**
 * Finds the furthest white cell along a ray from the maze center in a given direction.
 * 
 * Uses a DDA (Digital Differential Analyzer) style ray casting algorithm to trace from the
 * maze center outward along the specified angle until reaching a maze boundary, then returns
 * the lower node of the last white cell encountered.
 * 
 * @param maze - The maze to search within
 * @param angleDeg - The direction angle in degrees (0° = up, 90° = right, etc.)
 * @returns The lower node of the furthest white cell found along the ray
 * @throws {Error} If no white border cell is found in the specified direction
 * 
 * Note: Compass degrees (or clockwise from north) are used for angle input, where 0° is north, 
 * 90° is east, 180° is south, and 270° is west. This aligns with the domain (w3c) view. 
 */
export function findBorderCellByDegrees(maze: Maze, angleDeg: number): Node {
    const cells = maze.cells;
    // Convert from +/- compass to positive math degree
    const normalizedAngle = ((450 - angleDeg) % 360 + 360) % 360; 
    const angleRad = (normalizedAngle * Math.PI) / 180;
    const dx = Math.cos(angleRad);
    const dy = Math.sin(angleRad);
    let centerX = Math.floor(maze.width / 2);
    let centerY = Math.floor(maze.height / 2);
    let x = centerX;
    let y = centerY;

    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;

    const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
    const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);

    let tMaxX =
        dx === 0
            ? Infinity
            : dx > 0
            ? (x + 1 - (centerX + 0.5)) / dx
            : (centerX + 0.5 - x) / -dx;

    let tMaxY =
        dy === 0
            ? Infinity
            : dy > 0
            ? (y + 1 - (centerY + 0.5)) / dy
            : (centerY + 0.5 - y) / -dy;

    let furthest: Node | null = null;

    while (x >= 0 && y >= 0 && x < maze.width && y < maze.height) {
        if (cells[y][x].white) {
            furthest = cells[y][x].lower;
        }

        if (tMaxX <= tMaxY) {
            tMaxX += tDeltaX;
            x += stepX;
        } else {
            tMaxY += tDeltaY;
            y += stepY;
        }
    }

    if (furthest === null) {
        throw new Error('No border cell found in the ' + angleDeg + ' degree direction');
    }
    
    return furthest;  
}


function findBorderNodes(maze: Maze, entropy: Entropy): Set<Node> {
    const cells = maze.cells;
    const set = new Set<Cell>();
    for (let x = maze.width - 1; x >= 0; --x) {
        for (let y = 0; y < maze.height; ++y) {
            if (cells[y][x].white) {
                set.add(cells[y][x]);
                break;
            }
        }
        for (let y = maze.height - 1; y >= 0; --y) {
            if (cells[y][x].white) {
                set.add(cells[y][x]);
                break;
            }
        }
    }
    for (let y = maze.height - 1; y >= 0; --y) {
        for (let x = 0; x < maze.width; ++x) {
            if (cells[y][x].white) {
                set.add(cells[y][x]);
                break;
            }
        }
        for (let x = maze.width - 1; x >= 0; --x) {
            if (cells[y][x].white) {
                set.add(cells[y][x]);
                break;
            }
        }
    }
    const borderCells = Array.from(set);
    entropy.shuffleInPlace(borderCells);
    const borderNodes = new Set<Node>();
    borderCells.forEach(cell => borderNodes.add(cell.lower));
    return borderNodes;
}

/**
 * Performs a breadth-first search (BFS) flood-fill to evaluate paths through the maze from a given starting node. 
 * If a target node is provided, the optimal solution is the shortest path to that target.
 * If no target is specified, the optimal solution is the longest reachable path from the start node, favoring 
 * routes that are more engaging and visually interesting.
 * 
 * @param seed - The starting node for the flood fill algorithm
 * @param maze - The maze structure containing cells to traverse
 * @param borderNodes - A set of nodes that represent the border/exit points of the maze
 * @param bestSolution - An array that will be populated with the 'best' path found (modified in place)
 * @param targetNode - Optional target node to reach; if found, the search terminates immediately
 * 
 */
function flood(seed: Node, maze: Maze, borderNodes: Set<Node>, bestSolution: Node[], stack: Node[], targetNode?: Node | undefined) {
    const cells = maze.cells;
    for (let y = maze.height - 1; y >= 0; --y) {
        for (let x = maze.width - 1; x >= 0; --x) {
            const cell = cells[y][x];
            const { lower, upper } = cell;
            lower.visitedBy = null;
            upper.visitedBy = null;
        }
    }
    seed.visitedBy = seed;
    seed.region = 0;
    stack.push(seed);
    while (true) {
        const node = stack.pop();
        if (!node) {
            break;
        }
        const complete = targetNode ? node === targetNode : false;
        if (borderNodes.has(node) && (complete || node.region > bestSolution.length)) {
            bestSolution.length = 0;
            let n = node;
            while (true) {
                bestSolution.push(n);
                if (!n.visitedBy || n.visitedBy === n) {
                    break;
                }
                n = n.visitedBy;
            }
            if (complete) { 
                break;
            }
        }
        const nextLength = node.region + 1;
        if (node.north && !node.north.visitedBy) {
            node.north.visitedBy = node;
            node.north.region = nextLength;
            stack.push(node.north);
        }
        if (node.east && !node.east.visitedBy) {
            node.east.visitedBy = node;
            node.east.region = nextLength;
            stack.push(node.east);
        }
        if (node.south && !node.south.visitedBy) {
            node.south.visitedBy = node;
            node.south.region = nextLength;
                stack.push(node.south);
        }
        if (node.west && !node.west.visitedBy) {
            node.west.visitedBy = node;
            node.west.region = nextLength;
            stack.push(node.west);
            }
    }
}

function wireTerminal(maze: Maze, node: Node, entropy: Entropy) {
    const cells = maze.cells;
    const cell = node.cell;
    const permutation = entropy.randomElement(permutations);
    for (let i = permutation.length - 1; i >= 0; --i) {
        switch (permutation[i]) {
            case 0: {
                const y = cell.y - 1;
                if (y < 0 || !cells[y][cell.x].white) {
                    node.north = node.north2 = node;
                    return;
                }
                break;
            }
            case 1: {
                const x = cell.x + 1;
                if (x >= maze.width || !cells[cell.y][x].white) {
                    node.east = node.east2 = node;
                    return;
                }
                break;
            }
            case 2: {
                const y = cell.y + 1;
                if (y >= maze.height || !cells[y][cell.x].white) {
                    node.south = node.south2 = node;
                    return;
                }
                break;
            }
            default: {
                const x = cell.x - 1;
                if (x < 0 || !cells[cell.y][x].white) {
                    node.west = node.west2 = node;
                    return;
                }
                break;
            }
        }
    }
}

function wireSolution(solution: Node[], maze: Maze, entropy: Entropy) {
    const cells = maze.cells;
    for (let y = maze.height - 1; y >= 0; --y) {
        for (let x = maze.width - 1; x >= 0; --x) {
            const cell = cells[y][x];
            const { lower, upper } = cell;
            lower.north2 = lower.east2 = lower.south2 = lower.west2 = null;
            upper.north2 = upper.east2 = upper.south2 = upper.west2 = null;
        }
    }
    wireTerminal(maze, solution[0], entropy);
    wireTerminal(maze, solution[solution.length - 1], entropy);
    for (let i = solution.length - 2; i >= 0; --i) {
        const n0 = solution[i];
        const n1 = solution[i + 1];
        if (n0.north === n1) {
            n0.north2 = n1;
            n1.south2 = n0;
        } else if (n0.east === n1) {
            n0.east2 = n1;
            n1.west2 = n0;
        } else if (n0.south === n1) {
            n0.south2 = n1;
            n1.north2 = n0;
        } else if (n0.west === n1) {
            n0.west2 = n1;
            n1.east2 = n0;
        }
    }
}

export function solveMaze(maze: Maze, entropy: Entropy, entryAngle: number | undefined, exitAngle: number | undefined) {   
    const borderNodes = findBorderNodes(maze, entropy);
    const bestSolution: Node[] = [];
    const stack: Node[] = [];
    if (entryAngle || entryAngle === 0) {
        // Handle both entry-only and entry and exit specified cases.
        flood(findBorderCellByDegrees(maze, entryAngle), maze, borderNodes, bestSolution, stack, 
              exitAngle || exitAngle === 0 ? findBorderCellByDegrees(maze, exitAngle) : undefined);
    } else if (exitAngle || exitAngle === 0) {
        // Handle exit-only specified case.
        flood(findBorderCellByDegrees(maze, exitAngle), maze, borderNodes, bestSolution, stack);
        bestSolution.reverse();
    } else {
        // Best (longest) solution to select entry and exit nodes.
        borderNodes.forEach(node => flood(node, maze, borderNodes, bestSolution, stack));
    }

    wireSolution(bestSolution, maze, entropy);
}