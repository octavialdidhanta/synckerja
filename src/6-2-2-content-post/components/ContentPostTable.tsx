import { useMemo, useState } from "react";
import { MoreHorizontal, Eye, Edit, TrendingUp, Target, CreditCard, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { LoadingDots } from "@/shared/components/LoadingDots";
import { ContentPostTableFooter } from "../section/ContentPostTableFooter";
import { EditContentPostModal } from "../modals/EditContentPostModal";
import { UpdatePerformanceModal } from "../modals/UpdatePerformanceModal";
import { ConversionTrackingModal } from "../modals/ConversionTrackingModal";
import { UpdatePaymentModal } from "../modals/UpdatePaymentModal";

interface Props {
  contentPosts: any[];
  milestonesByPost: Record<string, any[]>;
  metricsByPostId: Record<string, any>;
  conversionByPostId: Record<string, { count: number; value: number }>;
  isLoading: boolean;
  onRefreshData: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdatePost: (id: string, payload: Record<string, unknown>) => Promise<void>;
}

export const ContentPostTable = ({
  contentPosts,
  milestonesByPost,
  metricsByPostId,
  conversionByPostId,
  isLoading,
  onRefreshData,
  onDelete,
  onUpdatePost,
}: Props) => {
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [showConversion, setShowConversion] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const postedPosts = useMemo(() => contentPosts.filter((post) => post.status === "posted").length, [contentPosts]);

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-brand-blue-soft shadow-sm shadow-brand-blue/10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="bg-brand-blue-soft text-xs font-medium text-brand-blue-deep">KOL & Campaign</TableHead>
                <TableHead className="bg-brand-blue-soft text-xs font-medium text-brand-blue-deep">Content</TableHead>
                <TableHead className="bg-brand-blue-soft text-xs font-medium text-brand-blue-deep">Status</TableHead>
                <TableHead className="bg-brand-blue-soft text-xs font-medium text-brand-blue-deep">Milestones</TableHead>
                <TableHead className="bg-brand-blue-soft text-xs font-medium text-brand-blue-deep">Performance</TableHead>
                <TableHead className="bg-brand-blue-soft text-xs font-medium text-brand-blue-deep">Conversions</TableHead>
                <TableHead className="w-20 bg-brand-blue-soft text-xs font-medium text-brand-blue-deep">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center"><LoadingDots size="lg" /></TableCell></TableRow>
              ) : contentPosts.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-brand-blue/75">Belum ada content post.</TableCell></TableRow>
              ) : (
                contentPosts.map((post) => {
                  const metrics = metricsByPostId[post.id] || {};
                  const conversion = conversionByPostId[post.id] || { count: 0, value: 0 };
                  const milestones = milestonesByPost[post.id] || [];
                  return (
                    <TableRow key={post.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-gray-900">{post.kol_profile?.name || "-"}</p>
                          <p className="text-xs text-gray-500">{post.campaign?.name || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-gray-900">{post.title || "-"}</p>
                          <p className="text-xs uppercase text-gray-500">{post.platform} • {post.content_type || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs capitalize text-gray-700">{post.status}</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">{milestones.length} milestone</p>
                          <p className="text-xs font-semibold text-gray-800">
                            Rp {Math.round(milestones.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0)).toLocaleString("id-ID")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-700">
                          <p>Views: {metrics.views || 0}</p>
                          <p>Engagement: {metrics.engagement_rate || 0}%</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-700">
                          <p>{conversion.count} conversions</p>
                          <p>Rp {Math.round(conversion.value).toLocaleString("id-ID")}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedPost(post)}>
                              <Eye className="mr-2 h-4 w-4" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedPost(post); setShowEdit(true); }}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedPost(post); setShowPerformance(true); }}>
                              <TrendingUp className="mr-2 h-4 w-4" /> Update Performance
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedPost(post); setShowConversion(true); }}>
                              <Target className="mr-2 h-4 w-4" /> Record Conversion
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedPost(post);
                                setSelectedMilestone(milestones[0] || null);
                                setShowPayment(true);
                              }}
                            >
                              <CreditCard className="mr-2 h-4 w-4" /> Update Payment
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={async () => {
                                if (window.confirm("Hapus content post ini?")) await onDelete(post.id);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <ContentPostTableFooter totalPosts={contentPosts.length} postedPosts={postedPosts} />
      </div>

      <EditContentPostModal
        open={showEdit}
        onOpenChange={setShowEdit}
        post={selectedPost}
        onSubmit={async (payload) => {
          if (!selectedPost) return;
          await onUpdatePost(selectedPost.id, payload);
          await onRefreshData();
        }}
      />
      <UpdatePerformanceModal open={showPerformance} onOpenChange={setShowPerformance} post={selectedPost} onSaved={onRefreshData} />
      <ConversionTrackingModal open={showConversion} onOpenChange={setShowConversion} post={selectedPost} onSaved={onRefreshData} />
      <UpdatePaymentModal open={showPayment} onOpenChange={setShowPayment} milestone={selectedMilestone} onSaved={onRefreshData} />
    </>
  );
};
