import { describe, expect, it } from 'vitest';
import { friendlyError, isConnectionError } from './errors';

describe('call errors', () => {
  it('spots a request that never got a real answer', () => {
    expect(isConnectionError({ code: 'functions/internal', message: 'internal' })).toBe(true);
    expect(isConnectionError({ code: 'functions/internal', message: 'internal [0]' })).toBe(true);
    expect(isConnectionError({ code: 'functions/unavailable', message: 'x' })).toBe(true);
    expect(isConnectionError({ code: 'functions/internal', message: 'Could not check this answer, try again.' })).toBe(false);
    expect(isConnectionError({ code: 'functions/failed-precondition', message: 'We could not hear you' })).toBe(false);
    expect(isConnectionError(null)).toBe(false);
  });
  it('keeps the server message, and explains a connection problem', () => {
    expect(friendlyError({ code: 'functions/internal', message: 'internal' })).toContain('Connection problem');
    expect(friendlyError({ code: 'functions/failed-precondition', message: 'We could not hear you, try again.' })).toBe('We could not hear you, try again.');
    expect(friendlyError({}, 'Fallback')).toBe('Fallback');
  });
});
