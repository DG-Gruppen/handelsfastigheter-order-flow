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
          {/* Vertical line down from parent */}
           <div className="w-px h-6 bg-border" />

          {children.length === 1 ? (
            /* Single child - just stack vertically */
            <OrgBranch
              profile={children[0]}
              childrenMap={childrenMap}
              roleMap={roleMap}
              draggedId={draggedId}
              onDragStart={onDragStart}
              onDrop={onDrop}
            />
          ) : (
            /* Multiple children - horizontal spread with connector bar */
            <div className="flex flex-col items-center">
              {/* Horizontal connector bar spanning from first to last child center */}
              <div className="relative flex">
                <div className="flex items-start gap-4">
                  {children.map((child, i) => (
                    <div key={child.id} className="flex flex-col items-center relative">
                      {/* Vertical stub up to the horizontal bar */}
                      <div className="w-px h-6 bg-border" />
                      <OrgBranch
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
                {/* Horizontal bar across children (positioned at top) */}
                {children.length > 1 && (
                  <div
                    className="absolute top-0 left-0 right-0 h-px bg-border"
                    style={{
                      left: `calc(${(100 / children.length) * 0.5}%)`,
                      right: `calc(${(100 / children.length) * 0.5}%)`,
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
