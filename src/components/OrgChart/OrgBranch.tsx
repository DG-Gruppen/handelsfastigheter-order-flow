import OrgCard, { OrgProfile, RoleMap } from "./OrgCard";

interface OrgBranchProps {
  profile: OrgProfile;
  childrenMap: Map<string | null, OrgProfile[]>;
  roleMap: RoleMap;
  draggedId: string | null;
  onDragStart: (id: string) => void;
  onDrop: (targetManagerId: string) => void;
}

export default function OrgBranch({
  profile,
  childrenMap,
  roleMap,
  draggedId,
  onDragStart,
  onDrop,
}: OrgBranchProps) {
  const children = (childrenMap.get(profile.id) ?? []).sort((a, b) =>
    (a.full_name || "").localeCompare(b.full_name || "")
  );

  return (
    <div className="flex flex-col items-center">
      <OrgCard
        profile={profile}
        roleMap={roleMap}
        draggedId={draggedId}
        onDragStart={onDragStart}
        onDrop={onDrop}
      />

      {children.length > 0 && (
        <>
          {/* Vertical connector down */}
          <div className="w-px h-6 bg-border" />

          {/* Children row */}
          <div className="relative flex items-start">
            {/* Horizontal connector bar */}
            {children.length > 1 && (
              <div
                className="absolute top-0 h-px bg-border"
                style={{
                  left: `calc(${(100 / children.length) * 0.5}% )`,
                  right: `calc(${(100 / children.length) * 0.5}% )`,
                }}
              />
            )}

            <div className="flex gap-2">
              {children.map((child) => (
                <div key={child.id} className="flex flex-col items-center">
                  {/* Vertical connector from bar to child */}
                  <div className="w-px h-6 bg-border" />
                  <OrgLeaf
                    profile={child}
                    childrenMap={childrenMap}
                    roleMap={roleMap}
                    draggedId={draggedId}
                    onDragStart={onDragStart}
                    onDrop={onDrop}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function OrgLeaf({
  profile,
  childrenMap,
  roleMap,
  draggedId,
  onDragStart,
  onDrop,
}: OrgBranchProps) {
  const children = (childrenMap.get(profile.id) ?? []).sort((a, b) =>
    (a.full_name || "").localeCompare(b.full_name || "")
  );

  return (
    <div className="flex flex-col items-center">
      <OrgCard
        profile={profile}
        roleMap={roleMap}
        draggedId={draggedId}
        onDragStart={onDragStart}
        onDrop={onDrop}
        compact={children.length === 0}
      />

      {children.length > 0 && (
        <>
          <div className="w-px h-4 bg-border" />
          <div className="relative flex items-start">
            {children.length > 1 && (
              <div
                className="absolute top-0 h-px bg-border"
                style={{
                  left: `calc(${(100 / children.length) * 0.5}%)`,
                  right: `calc(${(100 / children.length) * 0.5}%)`,
                }}
              />
            )}
            <div className="flex gap-1.5">
              {children.map((child) => (
                <div key={child.id} className="flex flex-col items-center">
                  <div className="w-px h-4 bg-border" />
                  <OrgCard
                    profile={child}
                    roleMap={roleMap}
                    draggedId={draggedId}
                    onDragStart={onDragStart}
                    onDrop={onDrop}
                    compact
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
