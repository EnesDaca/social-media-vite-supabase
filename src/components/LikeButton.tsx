import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabase-client";

interface Props {
  postId: number;
}

interface Vote {
  id: number;
  post_id: number;
  user_id: string;
  vote: number;
}

// Function to handle voting logic
const vote = async (voteValue: number, postId: number, userId: string) => {
  const { data: existingVote, error: fetchError } = await supabase
    .from("votes")
    .select("*")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);

  if (existingVote) {
    if (existingVote.vote === voteValue) {
      // Remove vote (toggle off)
      const { error } = await supabase
        .from("votes")
        .delete()
        .eq("id", existingVote.id);
      if (error) throw new Error(error.message);
      return;
    }

    // Update vote
    const { error } = await supabase
      .from("votes")
      .update({ vote: voteValue })
      .eq("id", existingVote.id);
    if (error) throw new Error(error.message);
    return;
  }

  // Insert new vote
  const { error } = await supabase
    .from("votes")
    .insert({ post_id: postId, user_id: userId, vote: voteValue });

  if (error) throw new Error(error.message);
};

// Function to fetch votes for a post
const fetchVotes = async (postId: number): Promise<Vote[]> => {
  const { data, error } = await supabase
    .from("votes")
    .select("*")
    .eq("post_id", postId);

  if (error) throw new Error(error.message);
  return data || [];
};

export const LikeButton = ({ postId }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch votes
  const {
    data: votes = [],
    isLoading,
    error,
  } = useQuery<Vote[], Error>({
    queryKey: ["votes", postId],
    queryFn: () => fetchVotes(postId),
  });

  // Handle voting mutation
  const { mutate, isPending } = useMutation({
    mutationFn: async (voteValue: number) => {
      if (!user) throw new Error("You must be logged in to vote!");
      await vote(voteValue, postId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["votes", postId] });
    },
    onError: (error) => {
      console.error("Voting error:", error.message);
    },
  });

  if (isLoading) return <div>Loading votes...</div>;
  if (error) return <div className="text-red-500">Error: {error.message}</div>;

  // Count likes & dislikes
  const likes = votes.filter((v) => v.vote === 1).length;
  const dislikes = votes.filter((v) => v.vote === -1).length;
  const userVote = votes.find((v) => v.user_id === user?.id)?.vote;

  return (
    <div className="flex items-center space-x-4 my-4">
      <button
        className={`px-3 py-1 cursor-pointer rounded transition-colors duration-150 ${
          userVote === 1 ? "bg-green-500 text-white" : "bg-gray-200 text-black"
        }`}
        onClick={() => mutate(1)}
        disabled={isPending}
      >
        👍 {likes}
      </button>
      <button
        className={`px-3 py-1 cursor-pointer rounded transition-colors duration-150 ${
          userVote === -1 ? "bg-red-500 text-white" : "bg-gray-200 text-black"
        }`}
        onClick={() => mutate(-1)}
        disabled={isPending}
      >
        👎 {dislikes}
      </button>
    </div>
  );
};
