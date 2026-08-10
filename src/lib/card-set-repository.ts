import {
    collection,
    doc,
    getDoc,
    getDocs,
    runTransaction,
    serverTimestamp,
    type Firestore,
    type Timestamp,
} from 'firebase/firestore';
import { parseCards, type CardData } from './cardLoader';

export const BUNDLED_CARD_SET_ID = 'bundled';
export const ACTIVE_CARD_SET_STORAGE_KEY = 'outpost7.activeCardSet';

interface StoredCardSet {
    name: string;
    source: string;
    cardCount: number;
    createdBy: string;
    createdAt?: Timestamp;
}

export interface CardSetRecord {
    id: string;
    name: string;
    source: string;
    cardCount: number;
    createdAtMillis: number;
}

function cleanCardSetName(name: string) {
    const cleaned = name.trim();
    if (!cleaned) throw new Error('Enter a card set name.');
    if (cleaned.length > 80) throw new Error('Card set names must be 80 characters or fewer.');
    return cleaned;
}

export function cardSetDocumentId(name: string) {
    const cleaned = cleanCardSetName(name).toLocaleLowerCase();
    const encoded = encodeURIComponent(cleaned).replace(/\./g, '%2E');
    return `set-${encoded}`;
}

export function validatePlayableCardSet(cards: CardData[]) {
    const moduleCards = cards.filter(({ background }) =>
        background.toLocaleLowerCase().includes('module'),
    );
    const startCards = cards.filter(({ background }) =>
        background.toLocaleLowerCase().includes('start'),
    );

    if (moduleCards.length < 25) {
        throw new Error('A playable set needs at least 25 module cards.');
    }
    if (startCards.length < 10) {
        throw new Error('A playable set needs at least 10 start cards.');
    }
    if (moduleCards.some(({ cost }) => !Number.isFinite(cost) || cost < 0)) {
        throw new Error('Every module card must have a numeric cost.');
    }
}

export async function createCardSet(
    db: Firestore,
    actorUid: string,
    name: string,
    source: string,
): Promise<CardSetRecord> {
    const cleanedName = cleanCardSetName(name);
    const cards = parseCards(source);
    validatePlayableCardSet(cards);
    const id = cardSetDocumentId(cleanedName);
    const reference = doc(db, 'cardSets', id);

    await runTransaction(db, async (transaction) => {
        if ((await transaction.get(reference)).exists()) {
            throw new Error(`A card set named “${cleanedName}” already exists.`);
        }
        transaction.set(reference, {
            name: cleanedName,
            source: source.trim(),
            cardCount: cards.length,
            createdBy: actorUid,
            createdAt: serverTimestamp(),
        });
    });

    return {
        id,
        name: cleanedName,
        source: source.trim(),
        cardCount: cards.length,
        createdAtMillis: Date.now(),
    };
}

function fromSnapshot(id: string, value: StoredCardSet): CardSetRecord {
    return {
        id,
        name: value.name,
        source: value.source,
        cardCount: value.cardCount,
        createdAtMillis: value.createdAt?.toMillis() ?? 0,
    };
}

export async function listCardSets(db: Firestore): Promise<CardSetRecord[]> {
    const snapshot = await getDocs(collection(db, 'cardSets'));
    return snapshot.docs
        .map((snapshotDocument) =>
            fromSnapshot(snapshotDocument.id, snapshotDocument.data() as StoredCardSet),
        )
        .sort((left, right) => left.name.localeCompare(right.name));
}

export async function loadCardSet(db: Firestore, id: string): Promise<CardSetRecord> {
    const snapshot = await getDoc(doc(db, 'cardSets', id));
    if (!snapshot.exists()) throw new Error('The selected card set is no longer available.');
    return fromSnapshot(snapshot.id, snapshot.data() as StoredCardSet);
}

export function cardsFromSet(cardSet: CardSetRecord): CardData[] {
    const cards = parseCards(cardSet.source);
    validatePlayableCardSet(cards);
    return cards;
}

export function getActiveCardSetId(storage: Pick<Storage, 'getItem'> = localStorage) {
    return storage.getItem(ACTIVE_CARD_SET_STORAGE_KEY) || BUNDLED_CARD_SET_ID;
}

export function setActiveCardSetId(
    id: string,
    storage: Pick<Storage, 'setItem'> = localStorage,
) {
    storage.setItem(ACTIVE_CARD_SET_STORAGE_KEY, id);
}
