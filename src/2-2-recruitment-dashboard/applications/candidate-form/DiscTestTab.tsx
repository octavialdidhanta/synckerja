import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { ClipboardList, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { getDiscResultFromScores } from '@/shared/lib/discResultUtils';

export type { DiscLevel } from '@/shared/lib/discResultUtils';

export interface TestQuestion {
  id: string;
  test_id: string;
  question_order: number;
  option_1_text: string;
  option_1_dimension: string;
  option_2_text: string;
  option_2_dimension: string;
  option_3_text: string;
  option_3_dimension: string;
  option_4_text: string;
  option_4_dimension: string;
}

export interface DiscTestTabProps {
  candidateProfileId: string;
  recruitmentToken: string;
  onTestCompleted?: () => void;
  /** When true (HR view e.g. /recruitment/candidates/), show full result detail after submit */
  isHRView?: boolean;
}

type Phase = 'idle' | 'running' | 'submitted' | 'time_expired';

const DEFAULT_DISC_TEST_ID = 'a1000000-0000-4000-8000-000000000001';

export function DiscTestTab({ candidateProfileId, recruitmentToken, onTestCompleted, isHRView }: DiscTestTabProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [candidateTestId, setCandidateTestId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [mostLike, setMostLike] = useState<number | null>(null);
  const [leastLike, setLeastLike] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [scores, setScores] = useState<{ score_d: number; score_i: number; score_s: number; score_c: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [existingStatus, setExistingStatus] = useState<'not_started' | 'in_progress' | 'submitted' | null>(null);
  const { toast } = useToast();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blurWarnedRef = useRef(false);

  const endsAtRef = useRef<number>(0);

  const fetchExistingTestAndQuestions = useCallback(async () => {
    if (!candidateProfileId) return;
    const { data: testMeta } = await supabase.from('tests').select('id, duration_minutes').eq('type', 'disc').eq('is_active', true).maybeSingle();
    const discTestId = (testMeta as { id: string; duration_minutes: number } | null)?.id ?? DEFAULT_DISC_TEST_ID;
    if (testMeta) setDurationMinutes((testMeta as { duration_minutes: number }).duration_minutes ?? 10);

    const { data: testRow, error: testErr } = await supabase
      .from('candidate_tests')
      .select('id, status, started_at, submitted_at, score_d, score_i, score_s, score_c')
      .eq('candidate_profile_id', candidateProfileId)
      .eq('test_id', discTestId)
      .maybeSingle();
    if (!testErr && testRow) {
      const row = testRow as { id: string; status: string; started_at?: string; submitted_at?: string; score_d?: number; score_i?: number; score_s?: number; score_c?: number };
      setCandidateTestId(row.id);
      if (row.status === 'submitted') {
        setExistingStatus('submitted');
        setPhase('submitted');
        setScores({
          score_d: row.score_d ?? 0,
          score_i: row.score_i ?? 0,
          score_s: row.score_s ?? 0,
          score_c: row.score_c ?? 0,
        });
        onTestCompleted?.();
        return;
      }
      if (row.status === 'in_progress' && row.started_at) {
        setExistingStatus('in_progress');
        setStartedAt(row.started_at);
        setPhase('running');
      }
    }
    const { data: qList } = await supabase
      .from('test_questions')
      .select('*')
      .eq('test_id', discTestId)
      .order('question_order', { ascending: true });
    setQuestions((qList as TestQuestion[]) ?? []);
  }, [candidateProfileId, onTestCompleted]);

  useEffect(() => {
    fetchExistingTestAndQuestions();
  }, [fetchExistingTestAndQuestions]);

  const handleTimeExpired = useCallback(async () => {
    if (!recruitmentToken || !candidateTestId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('disc_submit_test', {
        p_recruitment_token: recruitmentToken,
        p_candidate_test_id: candidateTestId,
      });
      if (error) throw error;
      setScores(data as { score_d: number; score_i: number; score_s: number; score_c: number });
      setPhase('time_expired');
      onTestCompleted?.();
      toast({ title: 'Waktu habis', description: 'Jawaban Anda telah disimpan dan dinilai.', variant: 'default' });
    } catch (e: unknown) {
      toast({ title: 'Gagal submit', description: (e as Error).message ?? 'Coba lagi.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [recruitmentToken, candidateTestId, onTestCompleted, toast]);

  useEffect(() => {
    if (phase !== 'running' || !startedAt || !durationMinutes) return;
    const start = new Date(startedAt).getTime();
    const end = start + durationMinutes * 60 * 1000;
    endsAtRef.current = end;
    const tick = () => {
      const now = Date.now();
      const rem = Math.max(0, Math.floor((end - now) / 1000));
      setRemainingSeconds(rem);
      if (rem <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleTimeExpired();
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, startedAt, durationMinutes, handleTimeExpired]);

  useEffect(() => {
    const onVisibility = () => {
      if (phase !== 'running' || document.visibilityState === 'visible') return;
      if (!blurWarnedRef.current) {
        blurWarnedRef.current = true;
        toast({ title: 'Peringatan', description: 'Jangan ganti tab. Tes harus diselesaikan dalam satu sesi.', variant: 'destructive' });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [phase, toast]);

  const startTest = async () => {
    if (!recruitmentToken?.trim()) {
      toast({ title: 'Error', description: 'Token tidak valid.', variant: 'destructive' });
      return;
    }
    if (questions.length === 0) {
      const { data: testMeta } = await supabase.from('tests').select('id').eq('type', 'disc').eq('is_active', true).maybeSingle();
      const discTestId = (testMeta as { id: string } | null)?.id ?? DEFAULT_DISC_TEST_ID;
      const { data: qList, error: qErr } = await supabase
        .from('test_questions')
        .select('*')
        .eq('test_id', discTestId)
        .order('question_order', { ascending: true });
      if (qErr || !qList?.length) {
        toast({
          title: 'Soal tes belum tersedia',
          description: 'Pastikan migrasi Tes DISC sudah dijalankan di database. Silakan hubungi administrator.',
          variant: 'destructive',
        });
        return;
      }
      setQuestions((qList as TestQuestion[]) ?? []);
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('disc_start_test', { p_recruitment_token: recruitmentToken.trim() });
      if (error) throw error;
      const payload = data as { candidate_test_id: string; started_at: string; duration_minutes: number };
      setCandidateTestId(payload.candidate_test_id);
      setStartedAt(payload.started_at);
      setDurationMinutes(payload.duration_minutes);
      setPhase('running');
      setCurrentQuestionIndex(0);
      setMostLike(null);
      setLeastLike(null);
      blurWarnedRef.current = false;
    } catch (e: unknown) {
      toast({ title: 'Gagal mulai tes', description: (e as Error).message ?? 'Coba lagi.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const submitAnswerAndNext = async () => {
    const q = questions[currentQuestionIndex];
    if (!q || mostLike == null || leastLike == null || mostLike === leastLike) {
      toast({ title: 'Pilih jawaban', description: 'Pilih satu Paling seperti saya dan satu Paling tidak seperti saya.', variant: 'destructive' });
      return;
    }
    if (!recruitmentToken || !candidateTestId) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('disc_submit_answer', {
        p_recruitment_token: recruitmentToken.trim(),
        p_candidate_test_id: candidateTestId,
        p_test_question_id: q.id,
        p_most_like_option_index: mostLike,
        p_least_like_option_index: leastLike,
      });
      if (error) throw error;
      setMostLike(null);
      setLeastLike(null);
      if (currentQuestionIndex + 1 >= questions.length) {
        const { data, error: err2 } = await supabase.rpc('disc_submit_test', {
          p_recruitment_token: recruitmentToken.trim(),
          p_candidate_test_id: candidateTestId,
        });
        if (err2) throw err2;
        setScores(data as { score_d: number; score_i: number; score_s: number; score_c: number });
        setPhase('submitted');
        onTestCompleted?.();
        toast({ title: 'Tes selesai', description: 'Hasil DISC Anda telah disimpan.', variant: 'default' });
      } else {
        setCurrentQuestionIndex((i) => i + 1);
      }
    } catch (e: unknown) {
      toast({ title: 'Gagal menyimpan jawaban', description: (e as Error).message ?? 'Coba lagi.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderDiscResultContent = () => {
    if (!scores) return null;
    const { description, jobMatch, level, caveats } = getDiscResultFromScores(scores);
    const d = Number(scores.score_d) ?? 0;
    const i = Number(scores.score_i) ?? 0;
    const s = Number(scores.score_s) ?? 0;
    const c = Number(scores.score_c) ?? 0;
    return (
      <>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="font-mono font-medium px-2 py-1 rounded bg-red-100 text-red-800">D: {d.toFixed(0)}</span>
          <span className="font-mono font-medium px-2 py-1 rounded bg-amber-100 text-amber-800">I: {i.toFixed(0)}</span>
          <span className="font-mono font-medium px-2 py-1 rounded bg-green-100 text-green-800">S: {s.toFixed(0)}</span>
          <span className="font-mono font-medium px-2 py-1 rounded bg-blue-100 text-blue-800">C: {c.toFixed(0)}</span>
        </div>
        <div className="border border-violet-200 rounded-md p-4 bg-violet-50/50">
          <h4 className="font-bold text-gray-900 mb-1">Rekomendasi Level</h4>
          <p className="text-sm text-gray-700 font-medium">{level}</p>
        </div>
        <div className="border border-green-600/30 rounded-md p-4 bg-green-50/50">
          <h4 className="font-bold text-gray-900 mb-2">Deskripsi Kepribadian</h4>
          <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
        </div>
        {caveats && (
          <div className="border border-amber-200 rounded-md p-4 bg-amber-50/70">
            <h4 className="font-bold text-amber-900 mb-2">Catatan</h4>
            <p className="text-sm text-gray-700 leading-relaxed">{caveats}</p>
          </div>
        )}
        <div className="border border-green-600/30 rounded-md p-4 bg-green-50/50">
          <h4 className="font-bold text-gray-900 mb-2">Job Match</h4>
          <p className="text-sm text-gray-700">{jobMatch}</p>
        </div>
      </>
    );
  };

  if (existingStatus === 'submitted' && phase === 'submitted') {
    if (isHRView && scores) {
      const { description, jobMatch, level, caveats } = getDiscResultFromScores(scores);
      const d = Number(scores.score_d) ?? 0;
      const i = Number(scores.score_i) ?? 0;
      const s = Number(scores.score_s) ?? 0;
      const c = Number(scores.score_c) ?? 0;
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Hasil Tes DISC
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="font-mono font-medium px-2 py-1 rounded bg-red-100 text-red-800">D: {d.toFixed(0)}</span>
              <span className="font-mono font-medium px-2 py-1 rounded bg-amber-100 text-amber-800">I: {i.toFixed(0)}</span>
              <span className="font-mono font-medium px-2 py-1 rounded bg-green-100 text-green-800">S: {s.toFixed(0)}</span>
              <span className="font-mono font-medium px-2 py-1 rounded bg-blue-100 text-blue-800">C: {c.toFixed(0)}</span>
            </div>
            <div className="border border-violet-200 rounded-md p-4 bg-violet-50/50">
              <h4 className="font-bold text-gray-900 mb-1">Rekomendasi Level</h4>
              <p className="text-sm text-gray-700 font-medium">{level}</p>
            </div>
            <div className="border border-green-600/30 rounded-md p-4 bg-green-50/50">
              <h4 className="font-bold text-gray-900 mb-2">Deskripsi Kepribadian</h4>
              <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
            </div>
            {caveats && (
              <div className="border border-amber-200 rounded-md p-4 bg-amber-50/70">
                <h4 className="font-bold text-amber-900 mb-2">Catatan</h4>
                <p className="text-sm text-gray-700 leading-relaxed">{caveats}</p>
              </div>
            )}
            <div className="border border-green-600/30 rounded-md p-4 bg-green-50/50">
              <h4 className="font-bold text-gray-900 mb-2">Job Match</h4>
              <p className="text-sm text-gray-700">{jobMatch}</p>
            </div>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Tes DISC
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg border border-green-200 bg-green-50/70">
            <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Tes DISC telah selesai.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === 'idle') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Tes DISC
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Tes ini mengukur gaya perilaku Anda berdasarkan empat dimensi: <strong>D</strong> (Dominance), <strong>I</strong> (Influence), <strong>S</strong> (Steadiness), <strong>C</strong> (Conscientiousness).
          </p>
          <p className="text-sm text-gray-600">
            Untuk setiap soal, pilih <strong>satu kata yang paling menggambarkan Anda</strong> (P) dan <strong>satu kata yang paling tidak menggambarkan Anda</strong> (K). Tidak ada jawaban benar atau salah.
          </p>
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-sm text-gray-700 space-y-1">
            <p className="font-medium text-gray-900">Cara hasil dihitung:</p>
            <ul className="list-disc list-inside space-y-0.5 text-gray-700">
              <li><strong>P (Paling seperti saya):</strong> Pilihan Anda = Anda mengidentifikasi dengan sifat itu. Dimensi yang terkait akan <strong>lebih menonjol</strong> di hasil.</li>
              <li><strong>K (Paling tidak seperti saya):</strong> Pilihan Anda = Anda paling tidak mengidentifikasi. Dimensi itu akan <strong>lebih rendah</strong> di hasil.</li>
            </ul>
            <p className="pt-1 text-gray-600">Deskripsi dan Job Match menggambarkan gaya perilaku Anda dalam konteks profesional berdasarkan kombinasi skor D, I, S, dan C.</p>
          </div>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>Durasi: {durationMinutes} menit.</li>
            <li>Harap selesaikan dalam satu sesi tanpa mengganti tab atau jendela.</li>
            <li>Setelah mulai, timer akan berjalan; waktu habis akan otomatis menyimpan jawaban.</li>
          </ul>
          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-amber-800 text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>Jangan menutup atau mengganti tab selama tes berlangsung.</span>
          </div>
          <Button onClick={startTest} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? 'Memulai...' : 'Mulai Tes DISC'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === 'running' && questions.length > 0) {
    const q = questions[currentQuestionIndex];
    const options = [
      { index: 1, text: q.option_1_text },
      { index: 2, text: q.option_2_text },
      { index: 3, text: q.option_3_text },
      { index: 4, text: q.option_4_text },
    ];
    const isLast = currentQuestionIndex >= questions.length - 1;
    const questionNo = currentQuestionIndex + 1;

    return (
      <Card>
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-2 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            <span className={cn('font-mono font-semibold', remainingSeconds <= 120 && 'text-red-600')}>
              Sisa waktu: {formatTime(remainingSeconds)}
            </span>
            {remainingSeconds > 0 && remainingSeconds <= 120 && (
              <span className="text-red-600 text-xs">(Segera selesaikan)</span>
            )}
          </div>
          <span className="text-sm text-gray-500">
            Soal {questionNo} / {questions.length}
          </span>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pilih satu P (Paling seperti saya) dan satu K (Paling tidak seperti saya)</CardTitle>
          <p className="text-xs text-gray-500 mt-1">P = paling menggambarkan Anda (dimensi naik). K = paling tidak menggambarkan Anda (dimensi turun).</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow className="bg-red-100/80">
                <TableHead className="w-14 font-semibold text-center">No.</TableHead>
                <TableHead className="w-16 text-center font-semibold bg-amber-200/80">P</TableHead>
                <TableHead className="w-16 text-center font-semibold bg-green-200/80">K</TableHead>
                <TableHead className="font-semibold">Gambaran Diri</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {options.map((opt, rowIdx) => (
                <TableRow key={opt.index} className={cn(rowIdx % 2 === 1 && 'bg-gray-50/50')}>
                  <TableCell className="text-center text-sm font-medium py-2">
                    {rowIdx === 0 ? questionNo : ''}
                  </TableCell>
                  <TableCell className="text-center py-2 bg-amber-50/50">
                    <div className="flex justify-center">
                      <input
                        type="radio"
                        name={`disc-p-${q.id}`}
                        checked={mostLike === opt.index}
                        onChange={() => setMostLike(opt.index)}
                        className="h-4 w-4"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-2 bg-green-50/50">
                    <div className="flex justify-center">
                      <input
                        type="radio"
                        name={`disc-k-${q.id}`}
                        checked={leastLike === opt.index}
                        onChange={() => setLeastLike(opt.index)}
                        className="h-4 w-4"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-sm">{opt.text}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-start pt-4">
            <Button onClick={submitAnswerAndNext} disabled={loading || mostLike == null || leastLike == null || mostLike === leastLike}>
              {loading ? 'Menyimpan...' : isLast ? 'Selesai & Kirim' : 'Lanjut'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === 'submitted' || phase === 'time_expired') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Hasil Tes DISC {phase === 'time_expired' ? '(Waktu habis)' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scores && renderDiscResultContent()}
          <p className="text-xs text-gray-500">Anda dapat melanjutkan ke Submit Profil.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-8">
        <p className="text-gray-500 text-center">Memuat tes...</p>
      </CardContent>
    </Card>
  );
}
