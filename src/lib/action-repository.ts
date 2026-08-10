import {
    collection,
    doc,
    onSnapshot,
    serverTimestamp,
    setDoc,
    type Firestore,
    type Timestamp,
    type Unsubscribe,
} from 'firebase/firestore';
import type { Card, PlayerColor } from './types';
import type { GameSettings } from './settingsStore';

export type ControllerEventType =
    | 'host/hand-updated'
    | 'player/registered'
    | 'player/selection-updated'
    | 'player/discarded';

export interface ControllerEvent {
    id: string;
    type: ControllerEventType;
    payload: Record<string, unknown>;
    actorUid: string;
    clientSeq: number;
    createdAtMillis: number;
}

export interface HandUpdatedPayload extends Record<string, unknown> {
    color: PlayerColor;
    hand: Card[];
    turn: PlayerColor;
    turnCount: number;
    settings: GameSettings;
    pendingBonusCardIds: string[];
}

interface StoredEvent {
    type: ControllerEventType;
    payload: Record<string, unknown>;
    actorUid: string;
    clientSeq: number;
    createdAt?: Timestamp;
}

export interface ActionRepository {
    append: (type: ControllerEventType, payload: Record<string, unknown>) => Promise<void>;
    subscribe: (
        onEvents: (events: ControllerEvent[]) => void,
        onError: (error: Error) => void,
        onStatus?: (status: 'offline' | 'syncing' | 'synced') => void,
    ) => Unsubscribe;
}

const compareRemoteEvents = (left: ControllerEvent, right: ControllerEvent) =>
    left.createdAtMillis - right.createdAtMillis || left.id.localeCompare(right.id);
const comparePendingEvents = (left: ControllerEvent, right: ControllerEvent) =>
    left.clientSeq - right.clientSeq || left.id.localeCompare(right.id);

export function orderEventStream(
    remote: ControllerEvent[],
    pending: ControllerEvent[],
): ControllerEvent[] {
    const remoteIds = new Set(remote.map(({ id }) => id));
    return [
        ...[...remote].sort(compareRemoteEvents),
        ...pending.filter(({ id }) => !remoteIds.has(id)).sort(comparePendingEvents),
    ];
}

export function createActionRepository(
    db: Firestore,
    gameId: string,
    actorUid: string,
): ActionRepository {
    const stream = collection(db, 'games', gameId, 'events');
    const clientId = crypto.randomUUID();
    let clientSeq = 0;
    let pending: ControllerEvent[] = [];
    let remote: ControllerEvent[] = [];
    let notify: ((events: ControllerEvent[]) => void) | undefined;
    const ordered = () => orderEventStream(remote, pending);

    return {
        async append(type, payload) {
            clientSeq += 1;
            const eventId = `${actorUid}-${clientId}-${String(clientSeq).padStart(8, '0')}`;
            pending.push({
                id: eventId,
                type,
                payload,
                actorUid,
                clientSeq,
                createdAtMillis: Date.now(),
            });
            notify?.(ordered());

            try {
                await setDoc(doc(stream, eventId), {
                    type,
                    payload,
                    actorUid,
                    clientSeq,
                    createdAt: serverTimestamp(),
                });
            } catch (error) {
                pending = pending.filter(({ id }) => id !== eventId);
                notify?.(ordered());
                throw error;
            }
        },

        subscribe(onEvents, onError, onStatus) {
            notify = onEvents;
            return onSnapshot(
                stream,
                { includeMetadataChanges: true },
                (snapshot) => {
                    remote = snapshot.docs
                        .filter((snapshotDocument) => !snapshotDocument.metadata.hasPendingWrites)
                        .map((snapshotDocument): ControllerEvent => {
                            const value = snapshotDocument.data() as StoredEvent;
                            return {
                                id: snapshotDocument.id,
                                type: value.type,
                                payload: value.payload,
                                actorUid: value.actorUid,
                                clientSeq: value.clientSeq,
                                createdAtMillis: value.createdAt?.toMillis() ?? 0,
                            };
                        });
                    const remoteIds = new Set(remote.map(({ id }) => id));
                    pending = pending.filter(({ id }) => !remoteIds.has(id));
                    onEvents(ordered());
                    onStatus?.(
                        snapshot.metadata.fromCache
                            ? 'offline'
                            : snapshot.metadata.hasPendingWrites
                              ? 'syncing'
                              : 'synced',
                    );
                },
                onError,
            );
        },
    };
}
