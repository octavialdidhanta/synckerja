export const ContentPostTableFooter = ({
  totalPosts,
  postedPosts,
}: {
  totalPosts: number;
  postedPosts: number;
}) => {
  return (
    <div className="flex items-center justify-between border-t border-brand-blue/20 bg-brand-blue-soft px-3 py-2 text-xs text-brand-blue-on-soft">
      <span>
        Total: <span className="font-medium text-brand-blue-deep">{totalPosts}</span> post
      </span>
      <span>
        Posted: <span className="font-medium text-brand-blue-deep">{postedPosts}</span>
      </span>
    </div>
  );
};
