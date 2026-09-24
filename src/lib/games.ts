import { and, asc, count, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

/** Filter values accepted by the game listing helpers. */
export type GameFilterOptions = {
    categoryIds?: Array<number | string>;
    publisherIds?: Array<number | string>;
};

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function normalizeFilterIds(values: Array<number | string> | undefined): number[] {
    if (!values) {
        return [];
    }

    return values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
}

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

export interface GamesPage {
    games: Game[];
    page: number;
    pageSize: number;
    totalGames: number;
    totalPages: number;
}

/**
 * Filters games by a case-insensitive title substring.
 *
 * @param games Games to search.
 * @param query Search text; surrounding whitespace is ignored.
 * @returns Games whose titles contain the normalized query.
 */
export function filterGamesByTitle(games: Game[], query: string): Game[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (normalizedQuery === '') return games;
    return games.filter((game) => game.title.toLocaleLowerCase().includes(normalizedQuery));
}

/**
 * Returns all games ordered alphabetically by title.
 *
 * @param db Injectable Drizzle database client used to query games and their relations.
 * @returns Every game in deterministic title order.
 */
export async function getAllGames(
    db: Database,
    filters: GameFilterOptions = {},
): Promise<Game[]> {
    const categoryIds = normalizeFilterIds(filters.categoryIds);
    const publisherIds = normalizeFilterIds(filters.publisherIds);
    const clauses = [];

    if (categoryIds.length > 0) clauses.push(inArray(games.categoryId, categoryIds));
    if (publisherIds.length > 0) clauses.push(inArray(games.publisherId, publisherIds));

    const query = baseGamesQuery(db);
    const filterableQuery = query as typeof query & {
        where: (condition: ReturnType<typeof and>) => typeof query;
    };
    const filteredQuery =
        clauses.length > 0 ? filterableQuery.where(and(...clauses)) : query;
    const rows = await filteredQuery.orderBy(asc(games.title));
    return rows.map(mapGame);
}

/**
 * Returns a page of games ordered alphabetically by title.
 *
 * @param db Injectable Drizzle database client used to query games and their relations.
 * @param page One-based page number to fetch.
 * @param pageSize Maximum number of games in the page.
 * @returns The requested page and its pagination metadata.
 */
export async function getGamesPage(
    db: Database,
    page: number,
    pageSize: number,
): Promise<GamesPage> {
    if (!Number.isInteger(page) || page < 1) {
        throw new RangeError('Page must be a positive integer.');
    }
    if (!Number.isInteger(pageSize) || pageSize < 1) {
        throw new RangeError('Page size must be a positive integer.');
    }

    const [{ totalGames }] = await db.select({ totalGames: count() }).from(games);
    const totalPages = Math.ceil(totalGames / pageSize);
    const rows = await baseGamesQuery(db)
        .orderBy(asc(games.title))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

    return {
        games: rows.map(mapGame),
        page,
        pageSize,
        totalGames,
        totalPages,
    };
}

/**
 * Returns categories ordered alphabetically by name.
 *
 * @param db Injectable Drizzle database client used to query categories.
 * @returns Category ids and names in deterministic order.
 */
export async function getAllCategories(db: Database): Promise<Array<{ id: number; name: string }>> {
    const rows = await db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .orderBy(asc(categories.name));
    return rows;
}

/**
 * Returns publishers ordered alphabetically by name.
 *
 * @param db Injectable Drizzle database client used to query publishers.
 * @returns Publisher ids and names in deterministic order.
 */
export async function getAllPublishers(db: Database): Promise<Array<{ id: number; name: string }>> {
    const rows = await db
        .select({ id: publishers.id, name: publishers.name })
        .from(publishers)
        .orderBy(asc(publishers.name));
    return rows;
}

/**
 * Returns all game ids ordered alphabetically by title.
 *
 * @param db Injectable Drizzle database client used to query game ids.
 * @returns Game ids in deterministic title order.
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/**
 * Returns a single game by id.
 *
 * @param db Injectable Drizzle database client used to query the game.
 * @param id Game id to look up.
 * @returns The matching game, or null when it does not exist.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
