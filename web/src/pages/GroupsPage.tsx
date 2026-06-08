import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';

export function GroupsPage() {
  const qc = useQueryClient();
  const groups = useQuery({ queryKey: ['groups'], queryFn: api.listGroups });
  const [newName, setNewName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createGroup = useMutation({
    mutationFn: () => api.createGroup(newName),
    onSuccess: () => {
      setNewName('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed to create group'),
  });

  const joinGroup = useMutation({
    mutationFn: () => api.joinGroup(code),
    onSuccess: () => {
      setCode('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed to join group'),
  });

  return (
    <div className="groups-page">
      <h2>Your groups</h2>
      {groups.isLoading && <p>Loading…</p>}
      <ul className="group-list">
        {groups.data?.map((g) => (
          <li key={g.id} data-testid={`group-${g.id}`}>
            <Link to={`/groups/${g.id}`}>{g.name}</Link>
            <span className="muted"> · {g.memberCount} member{g.memberCount === 1 ? '' : 's'}</span>
          </li>
        ))}
        {groups.data?.length === 0 && <p className="muted">No groups yet — create or join one below.</p>}
      </ul>

      {error && <p className="error">{error}</p>}

      <div className="card">
        <h3>Create a group</h3>
        <div className="row">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Group name"
            maxLength={40}
            data-testid="create-group-name"
          />
          <button disabled={!newName.trim() || createGroup.isPending} onClick={() => createGroup.mutate()} data-testid="create-group-button">
            Create
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Join a group</h3>
        <div className="row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
            placeholder="Invite code"
            data-testid="join-group-code"
          />
          <button disabled={code.length !== 8 || joinGroup.isPending} onClick={() => joinGroup.mutate()} data-testid="join-group-button">
            Join
          </button>
        </div>
      </div>
    </div>
  );
}
