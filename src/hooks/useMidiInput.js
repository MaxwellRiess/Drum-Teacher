import { useState, useEffect, useRef, useCallback } from 'react';

// Web MIDI input. Chrome and Edge support this; Firefox 108+ does; Safari does
// not ship it at all. Requires a secure context, so localhost or https.
//
// Note-on events are delivered through a callback held in a ref rather than
// through React state. Hits arrive at up to ~10/second during fast playing and
// must not each cause a render.
//
// On timing: we use event.timeStamp, not performance.now() read inside the
// handler. Chrome stamps the message when its MIDI backend receives it, so the
// measurement stays accurate even when the main thread is busy rendering. Jank
// costs display smoothness, not timing precision.

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

export const useMidiInput = ({ onNoteOn, verbose = false } = {}) => {
    const supported = typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess;

    const [status, setStatus] = useState(supported ? 'idle' : 'unsupported');
    const [error, setError] = useState(null);
    const [inputs, setInputs] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [lastMessage, setLastMessage] = useState(null);

    const accessRef = useRef(null);
    const onNoteOnRef = useRef(onNoteOn);
    const verboseRef = useRef(verbose);
    const selectedIdRef = useRef(selectedId);

    useEffect(() => { onNoteOnRef.current = onNoteOn; }, [onNoteOn]);
    useEffect(() => { verboseRef.current = verbose; }, [verbose]);
    useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

    const refreshInputs = useCallback((access) => {
        const list = [];
        access.inputs.forEach(input => {
            list.push({
                id: input.id,
                name: input.name || 'Unnamed device',
                manufacturer: input.manufacturer || '',
            });
        });
        setInputs(list);
        return list;
    }, []);

    const handleMessage = useCallback((event) => {
        const [statusByte, note, velocity] = event.data;
        const command = statusByte & 0xf0;

        // A note-on with zero velocity is a note-off — the convention most
        // devices actually use. Treating it as a hit registers phantom notes.
        const isNoteOn = command === NOTE_ON && velocity > 0;
        if (!isNoteOn && command !== NOTE_OFF) return;

        if (verboseRef.current) {
            setLastMessage({
                note,
                velocity,
                channel: statusByte & 0x0f,
                type: isNoteOn ? 'on' : 'off',
                at: event.timeStamp,
            });
        }

        if (!isNoteOn) return;

        // event.timeStamp is meant to be in the performance.now() domain,
        // stamped at receipt by the MIDI backend. If a browser ever stamps it
        // in some other epoch, every hit lands somewhere absurd on the timeline
        // and nothing ever matches. Sanity-check it and fall back to reading
        // the clock here — less precise under load, but never catastrophically
        // wrong.
        const now = performance.now();
        const stamped = event.timeStamp;
        const trustworthy = typeof stamped === 'number'
            && Number.isFinite(stamped)
            && Math.abs(stamped - now) < 5000;

        onNoteOnRef.current?.({
            note,
            velocity,
            channel: statusByte & 0x0f,
            perfTime: trustworthy ? stamped : now,
            stampSuspect: !trustworthy,
        });
    }, []);

    // Routes messages from the selected port only. Aerodrums can appear
    // alongside other MIDI gear, and listening to everything would double-count.
    const attachListeners = useCallback((access, targetId) => {
        access.inputs.forEach(input => {
            input.onmidimessage = input.id === targetId ? handleMessage : null;
        });
    }, [handleMessage]);

    const requestAccess = useCallback(async () => {
        if (!supported) {
            setStatus('unsupported');
            return;
        }
        setStatus('requesting');
        setError(null);
        try {
            // sysex: false keeps the permission prompt to the mild version. We
            // only need note data.
            const access = await navigator.requestMIDIAccess({ sysex: false });
            accessRef.current = access;
            setStatus('granted');

            const list = refreshInputs(access);

            // Auto-select. Prefer something that looks like the Aerodrums kit,
            // otherwise take the only device if there is exactly one.
            const preferred =
                list.find(i => /aero/i.test(i.name + i.manufacturer)) ??
                (list.length === 1 ? list[0] : null);

            if (preferred) {
                setSelectedId(preferred.id);
                attachListeners(access, preferred.id);
            }

            access.onstatechange = () => {
                const updated = refreshInputs(access);
                const stillThere = updated.some(i => i.id === selectedIdRef.current);
                if (!stillThere) setSelectedId(null);
                attachListeners(access, selectedIdRef.current);
            };
        } catch (err) {
            setStatus('denied');
            setError(err?.message || 'MIDI access was refused');
        }
    }, [supported, refreshInputs, attachListeners]);

    const selectInput = useCallback((id) => {
        setSelectedId(id);
        if (accessRef.current) attachListeners(accessRef.current, id);
    }, [attachListeners]);

    // Detach on unmount so a hot reload doesn't leave orphaned handlers
    // stacking up on the port.
    useEffect(() => () => {
        const access = accessRef.current;
        if (access) access.inputs.forEach(input => { input.onmidimessage = null; });
    }, []);

    return {
        supported,
        status,
        error,
        inputs,
        selectedId,
        selectInput,
        requestAccess,
        lastMessage,
    };
};
