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

  // Separate: children with their own subordinates (branches) vs leaf employees
  const branches = children.filter((c) => (childrenMap.get(c.id) ?? []).length > 0);
  const leaves = children.filter((c) => (childrenMap.get(c.id) ?? []).length === 0);

  const branchProps = (child: OrgProfile) => ({
    profile: child,
    childrenMap,
    roleMap,
    draggedId,
    onDragStart,
    onDrop,
  });

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
          {/* Vertical line down from parent */}
          <div className="w-px h-6 bg-border" />

          {/* Layout: branches horizontally, leaves vertically beneath */}
          {branches.length === 0 ? (
            /* Only leaf employees – stack vertically */
            <div className="flex flex-col items-center gap-0">
              {leaves.map((leaf) => (
                <div key={leaf.id} className="flex flex-col items-center">
                  <OrgCard
                    profile={leaf}
                    roleMap={roleMap}
                    draggedId={draggedId}
                    onDragStart={onDragStart}
                    onDrop={onDrop}
                    compact
                  />
                  {leaves.indexOf(leaf) < leaves.length - 1 && (
                    <div className="w-px h-2 bg-border" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {/* Horizontal spread for branches (and leaves mixed in) */}
              <div className="relative flex">
                <div className="flex items-start gap-4">
                  {branches.map((child) => (
                    <div key={child.id} className="flex flex-col items-center relative">
                      <div className="w-px h-6 bg-border" />
                      <OrgBranch {...branchProps(child)} />
                    </div>
                  ))}
                  {/* Leaf employees as a vertical stack column */}
                  {leaves.length > 0 && (
                    <div className="flex flex-col items-center relative">
                      <div className="w-px h-6 bg-border" />
                      <div className="flex flex-col items-center gap-0">
                        {leaves.map((leaf, i) => (
                          <div key={leaf.id} className="flex flex-col items-center">
                            <OrgCard
                              profile={leaf}
                              roleMap={roleMap}
                              draggedId={draggedId}
                              onDragStart={onDragStart}
                              onDrop={onDrop}
                              compact
                            />
                            {i < leaves.length - 1 && (
                              <div className="w-px h-2 bg-border" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* Horizontal bar across all columns */}
                {(branches.length + (leaves.length > 0 ? 1 : 0)) > 1 && (
                  <div
                    className="absolute top-0 left-0 right-0 h-px bg-border"
                    style={{
                      left: `calc(${(100 / (branches.length + (leaves.length > 0 ? 1 : 0))) * 0.5}%)`,
                      right: `calc(${(100 / (branches.length + (leaves.length > 0 ? 1 : 0))) * 0.5}%)`,
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
