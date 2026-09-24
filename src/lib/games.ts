import { and, asc, eq, inArray } from 'drizzle-orm';
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

/** All games ordered by title, optionally narrowed by category and publisher filter values. */
export async function getAllGames(db: Database, filters: GameFilterOptions = {}): Promise<Game[]> {
    const categoryIds = normalizeFilterIds(filters.categoryIds);
    const publisherIds = normalizeFilterIds(filters.publisherIds);
    const clauses = [];

    if (categoryIds.length > 0) {
        clauses.push(inArray(games.categoryId, categoryIds));
    }

    if (publisherIds.length > 0) {
        clauses.push(inArray(games.publisherId, publisherIds));
    }

    const query = baseGamesQuery(db);
    const filterableQuery = query as typeof query & {
        where: (condition: ReturnType<typeof and>) => typeof query;
    };

    const filteredQuery = clauses.length > 0 ? filterableQuery.where(and(...clauses)) : query;
    const rows = await filteredQuery.orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All categories ordered alphabetically by name. */
export async function getAllCategories(db: Database): Promise<Array<{ id: number; name: string }>> {
    const rows = await db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .orderBy(asc(categories.name));
    return rows;
}

/** All publishers ordered alphabetically by name. */
export async function getAllPublishers(db: Database): Promise<Array<{ id: number; name: string }>> {
    const rows = await db
        .select({ id: publishers.id, name: publishers.name })
        .from(publishers)
        .orderBy(asc(publishers.name));
    return rows;
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
