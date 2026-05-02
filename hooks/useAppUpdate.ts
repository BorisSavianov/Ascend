import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { UpdateCandidate, UpdateUiState } from '../lib/update/types';
import { createUpdateService } from '../lib/update/UpdateService';
import type { UpdateService } from '../lib/update/UpdateService';

type UpdateActions = {
  installNow: () => Promise<void>;
  snooze: () => Promise<void>;
  retry: () => Promise<void>;
  openInstallSettings: () => Promise<void>;
};

export type AppUpdateController = UpdateUiState & UpdateActions;

function emptyState(): UpdateUiState {
  return {
    visible: false,
    status: 'idle',
    candidate: null,
    progress: null,
    error: null,
  };
}

export function useAppUpdate(): AppUpdateController {
  const serviceRef = useRef<UpdateService | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = createUpdateService();
  }

  const service = serviceRef.current;
  const [state, setState] = useState<UpdateUiState>(emptyState);
  const candidateRef = useRef<UpdateCandidate | null>(null);
  const checkingRef = useRef(false);
  const installInFlightRef = useRef(false);

  const refresh = async () => {
    if (checkingRef.current || installInFlightRef.current) return;
    checkingRef.current = true;
    setState((current) => ({ ...current, status: 'checking', error: null }));
    try {
      const candidate = await service.checkForUpdate();
      candidateRef.current = candidate;
      setState({
        visible: Boolean(candidate),
        status: candidate ? 'available' : 'idle',
        candidate,
        progress: null,
        error: null,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        status: 'error',
        error: error instanceof Error ? error.message : 'Update check failed',
      }));
    } finally {
      checkingRef.current = false;
    }
  };

  useEffect(() => {
    void refresh();

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void refresh();
      } else if (nextState === 'background') {
        void service.pauseActiveDownload();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [service]);

  const installNow = async () => {
    const candidate = candidateRef.current;
    if (!candidate) return;
    if (installInFlightRef.current) return;

    installInFlightRef.current = true;

    setState((current) => ({
      ...current,
      status: 'downloading',
      error: null,
      visible: true,
    }));

    try {
      await service.install(
        candidate,
        (progress) => {
          setState((current) => ({
            ...current,
            progress,
            status: progress?.percent === 100 ? 'verifying' : 'downloading',
          }));
        },
        () => {
          setState((current) => ({
            ...current,
            status: 'installing',
            error: null,
          }));
        },
      );
      setState((current) => ({
        ...current,
        status: 'error',
        error: 'Installer closed before the update completed. Try again or enable Install unknown apps.',
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to install update',
      }));
    } finally {
      installInFlightRef.current = false;
    }
  };

  const snooze = async () => {
    const candidate = candidateRef.current;
    if (!candidate) return;
    await service.snooze(candidate);
    setState(emptyState());
  };

  const retry = async () => {
    await refresh();
  };

  const openInstallSettings = async () => {
    await service.openInstallSettings();
  };

  return {
    ...state,
    installNow,
    snooze,
    retry,
    openInstallSettings,
  };
}
