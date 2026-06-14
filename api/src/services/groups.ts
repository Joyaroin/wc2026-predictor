import type { Group } from '@wc2026/shared';
import type { Clock } from '../lib/clock';
import type { GroupRepo, MembershipRepo, PlayerRepo } from '../repos/types';
import type { GroupSummary, PublicPlayer } from './dtos';
import { ForbiddenError, NotFoundError } from '../lib/errors';
import { newId, newInviteCode } from '../lib/ids';

export interface GroupService {
  create(callerId: string, name: string): Promise<Group>;
  join(callerId: string, inviteCode: string): Promise<Group>;
  listForPlayer(callerId: string): Promise<GroupSummary[]>;
  get(callerId: string, groupId: string): Promise<Group & { memberCount: number }>;
  listMembers(callerId: string, groupId: string): Promise<PublicPlayer[]>;
  assertMember(callerId: string, groupId: string): Promise<void>;
  remove(callerId: string, groupId: string): Promise<void>;
  leave(callerId: string, groupId: string): Promise<void>;
}

export function createGroupService(
  groups: GroupRepo,
  memberships: MembershipRepo,
  players: PlayerRepo,
  clock: Clock,
): GroupService {
  async function assertMember(callerId: string, groupId: string): Promise<void> {
    if (!(await memberships.isMember(groupId, callerId))) {
      throw new ForbiddenError('Not a member of this group');
    }
  }

  async function uniqueInviteCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = newInviteCode();
      if (!(await groups.getByInviteCode(code))) return code;
    }
    throw new Error('Could not generate a unique invite code');
  }

  return {
    assertMember,
    async create(callerId, name) {
      const now = clock.now().toISOString();
      const group: Group = {
        id: newId(),
        name: name.trim(),
        inviteCode: await uniqueInviteCode(),
        createdBy: callerId,
        createdAt: now,
      };
      await groups.create(group);
      await memberships.add(group.id, callerId, now);
      return group;
    },
    async join(callerId, inviteCode) {
      const group = await groups.getByInviteCode(inviteCode);
      if (!group) throw new NotFoundError('Group not found');
      if (!(await memberships.isMember(group.id, callerId))) {
        await memberships.add(group.id, callerId, clock.now().toISOString());
      }
      return group;
    },
    async listForPlayer(callerId) {
      const groupIds = await memberships.listGroups(callerId);
      // Resolve each group + its member count in parallel (was a sequential ~2N round-trip N+1 on
      // the GET /groups critical path), mirroring the parallelized leaderboard fix.
      const summaries = await Promise.all(
        groupIds.map(async (id): Promise<GroupSummary | null> => {
          const [group, members] = await Promise.all([groups.getById(id), memberships.listMembers(id)]);
          if (!group) return null;
          return { id: group.id, name: group.name, memberCount: members.length };
        }),
      );
      return summaries.filter((s): s is GroupSummary => s !== null);
    },
    async get(callerId, groupId) {
      await assertMember(callerId, groupId);
      const group = await groups.getById(groupId);
      if (!group) throw new NotFoundError('Group not found');
      const memberCount = (await memberships.listMembers(groupId)).length;
      return { ...group, memberCount };
    },
    async listMembers(callerId, groupId) {
      await assertMember(callerId, groupId);
      const ids = await memberships.listMembers(groupId);
      const result: PublicPlayer[] = [];
      for (const id of ids) {
        const p = await players.getById(id);
        if (p) result.push({ id: p.id, name: p.name });
      }
      return result;
    },
    async remove(callerId, groupId) {
      const group = await groups.getById(groupId);
      if (!group) throw new NotFoundError('Group not found');
      if (group.createdBy !== callerId) throw new ForbiddenError('Only the group creator can delete it');
      await memberships.removeAll(groupId);
      await groups.delete(groupId);
    },
    async leave(callerId, groupId) {
      await assertMember(callerId, groupId);
      const group = await groups.getById(groupId);
      if (group && group.createdBy === callerId) {
        throw new ForbiddenError('The creator must delete the group instead of leaving');
      }
      await memberships.remove(groupId, callerId);
    },
  };
}
