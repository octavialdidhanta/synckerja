export const ContentPostSidebarFooter = ({
  totalPosts,
  postedPosts,
}: {
  totalPosts: number;
  postedPosts: number;
}) => {
  const completion = totalPosts ? Math.round((postedPosts / totalPosts) * 100) : 0;
  return (
    <div className="border-t border-brand-blue/20 bg-brand-blue-soft px-4 py-2">
      <div className="mb-1 flex items-center justify-between text-xs text-brand-blue-on-soft">
        <span>Progress Post</span>
        <span className="font-medium text-brand-blue-deep">{completion}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-brand-blue/15">
        <div className="h-1.5 rounded-full bg-brand-blue transition-all" style={{ width: `${completion}%` }} />
      </div>
    </div>
  );
};
