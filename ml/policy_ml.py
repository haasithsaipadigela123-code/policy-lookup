"""
Policy Lookup — Local Machine Learning & Policy Retrieval Engine
Powered by scikit-learn & numpy (100% Local, Zero Cloud Dependencies)

Architecture:
1. Unsupervised Policy Retrieval: TF-IDF Vector Space Model & Cosine Similarity.
   Indexes user-uploaded policy documents to find relevant candidate sections.
2. Supervised Ticket Classification: Logistic Regression & Naive Bayes.
   Strictly activated ONLY when legitimate labelled ticket-to-policy examples
   are supplied. Never treats raw policy paragraphs as fake labelled tickets.
"""

import sys
import json
import argparse
from typing import List, Dict, Any, Optional

try:
    import numpy as np
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.naive_bayes import MultinomialNB
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError as e:
    sys.stderr.write(f"Error loading scikit-learn/numpy: {e}\n")
    sys.exit(1)


class PolicyRetriever:
    """
    Unsupervised Vector Space Model using TF-IDF and Cosine Similarity
    for local policy document indexing and candidate retrieval.
    """

    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            sublinear_tf=True,
            stop_words='english',
            token_pattern=r'(?u)\b\w+\b'
        )
        self.policies: List[Dict[str, Any]] = []
        self.policy_ids: List[str] = []
        self.tfidf_matrix = None
        self.is_indexed = False

    def _extract_policy_text(self, policy: Dict[str, Any]) -> str:
        parts = [
            str(policy.get('name', '')),
            str(policy.get('category', '')),
            str(policy.get('conditions', '')),
            str(policy.get('exceptions', '')),
            str(policy.get('resolution', '')),
            str(policy.get('rawText', ''))
        ]
        keywords = policy.get('keywords', [])
        if isinstance(keywords, list):
            parts.append(' '.join(str(k) for k in keywords))
        elif isinstance(keywords, str):
            parts.append(keywords)

        synonyms = policy.get('synonyms', [])
        if isinstance(synonyms, list):
            parts.append(' '.join(str(s) for s in synonyms))

        return ' '.join(p for p in parts if p.strip())

    def index_policies(self, policies: List[Dict[str, Any]]) -> "PolicyRetriever":
        if not policies:
            self.is_indexed = False
            self.policies = []
            self.policy_ids = []
            self.tfidf_matrix = None
            return self

        self.policies = policies
        self.policy_ids = [p.get('id', f'POL_{i+1}') for i, p in enumerate(policies)]
        corpus = [self._extract_policy_text(p) for p in policies]

        self.tfidf_matrix = self.vectorizer.fit_transform(corpus)
        self.is_indexed = True
        return self

    def retrieve_candidates(self, query_text: str) -> Dict[str, Any]:
        if not self.is_indexed or not self.policies or self.tfidf_matrix is None:
            return {
                "success": False,
                "error": "No policies indexed. Upload policy documents first.",
                "matched": False
            }

        if not query_text or not query_text.strip():
            return {
                "success": True,
                "matched": False,
                "reason": "Query text is empty."
            }

        query_vec = self.vectorizer.transform([query_text])
        similarities = cosine_similarity(query_vec, self.tfidf_matrix)[0]

        ranked_indices = np.argsort(similarities)[::-1]
        top_idx = int(ranked_indices[0])
        top_sim = float(round(similarities[top_idx], 4))
        top_policy = self.policies[top_idx]
        top_id = self.policy_ids[top_idx]

        feature_names = self.vectorizer.get_feature_names_out()
        query_tokens = query_vec.tocoo()
        top_features = []
        if query_tokens.nnz > 0:
            token_scores = list(zip(query_tokens.col, query_tokens.data))
            token_scores.sort(key=lambda x: x[1], reverse=True)
            top_features = [feature_names[idx] for idx, _ in token_scores[:6]]

        # Honest retrieval threshold
        matched = top_sim >= 0.12

        runner_up = None
        is_ambiguous = False
        if len(ranked_indices) > 1:
            second_idx = int(ranked_indices[1])
            second_sim = float(round(similarities[second_idx], 4))
            second_id = self.policy_ids[second_idx]
            if top_sim > 0 and (top_sim - second_sim < 0.08 or second_sim >= top_sim * 0.85):
                is_ambiguous = True
                runner_up = {
                    "id": second_id,
                    "name": self.policies[second_idx].get("name", second_id),
                    "similarity": second_sim
                }

        return {
            "success": True,
            "matched": bool(matched),
            "topCandidate": {
                "id": top_id,
                "name": top_policy.get("name", top_id),
                "category": top_policy.get("category", "General"),
                "similarity": top_sim,
                "resolution": top_policy.get("resolution", ""),
                "conditions": top_policy.get("conditions", ""),
                "exceptions": top_policy.get("exceptions", ""),
                "sourceDocName": top_policy.get("sourceDocName", "Policy Document")
            } if matched else None,
            "similarityScore": top_sim,
            "topKeywords": top_features,
            "isAmbiguous": is_ambiguous,
            "runnerUp": runner_up
        }


class SupervisedTicketClassifier:
    """
    Supervised Machine Learning Classifier.
    Trained strictly on real, labelled (ticket, policy_id) pairs.
    """

    def __init__(self):
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words='english')
        self.clf = LogisticRegression(C=1.0, max_iter=200)
        self.is_trained = False
        self.sample_count = 0
        self.classes = []

    def train(self, labelled_examples: List[Dict[str, str]]) -> Dict[str, Any]:
        if not labelled_examples:
            self.is_trained = False
            return {"success": False, "reason": "No labelled training data supplied."}

        valid_pairs = [e for e in labelled_examples if e.get("ticket") and e.get("policyId")]
        unique_classes = set(e["policyId"] for e in valid_pairs)

        if len(unique_classes) < 2:
            self.is_trained = False
            return {
                "success": False,
                "reason": "Supervised training requires labelled tickets for at least 2 distinct policy classes."
            }

        texts = [e["ticket"] for e in valid_pairs]
        labels = [e["policyId"] for e in valid_pairs]

        X = self.vectorizer.fit_transform(texts)
        self.clf.fit(X, labels)
        self.is_trained = True
        self.sample_count = len(valid_pairs)
        self.classes = list(self.clf.classes_)

        return {
            "success": True,
            "is_trained": True,
            "sampleCount": self.sample_count,
            "classCount": len(self.classes)
        }

    def predict(self, ticket_text: str) -> Dict[str, Any]:
        if not self.is_trained:
            return {
                "isTrained": False,
                "message": "Supervised model is untrained (no labelled ticket training data provided).",
                "probabilities": {}
            }

        X = self.vectorizer.transform([ticket_text])
        proba = self.clf.predict_proba(X)[0]
        probabilities = {cls: float(round(p, 4)) for cls, p in zip(self.classes, proba)}
        top_idx = int(np.argmax(proba))

        return {
            "isTrained": True,
            "topClass": self.classes[top_idx],
            "probability": float(round(proba[top_idx], 4)),
            "probabilities": probabilities,
            "sampleCount": self.sample_count
        }


# Integrated ML Pipeline
class PolicyMLPipeline:
    def __init__(self):
        self.retriever = PolicyRetriever()
        self.classifier = SupervisedTicketClassifier()

    def analyze(self, ticket_text: str, policies: List[Dict[str, Any]], labelled_data: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        if policies:
            self.retriever.index_policies(policies)

        if labelled_data:
            self.classifier.train(labelled_data)

        # 1. Unsupervised Vector Retrieval
        retrieval_res = self.retriever.retrieve_candidates(ticket_text)

        # 2. Supervised Classification (if trained)
        clf_res = self.classifier.predict(ticket_text)

        return {
            "success": True,
            "engine": "scikit-learn",
            "retrieval": {
                "method": "TF-IDF Vector Space Model (Cosine Similarity)",
                "indexedPolicies": len(self.retriever.policies),
                "similarityScore": retrieval_res.get("similarityScore", 0.0),
                "topKeywords": retrieval_res.get("topKeywords", []),
                "isAmbiguous": retrieval_res.get("isAmbiguous", False),
                "runnerUp": retrieval_res.get("runnerUp")
            },
            "supervisedClassifier": {
                "isTrained": clf_res.get("isTrained", False),
                "sampleCount": clf_res.get("sampleCount", 0),
                "probabilities": clf_res.get("probabilities", {}),
                "message": clf_res.get("message", "Model active on labelled ticket data.")
            },
            "matched": retrieval_res.get("matched", False),
            "topMatch": retrieval_res.get("topCandidate")
        }


def run_server(port: int = 5000):
    from http.server import HTTPServer, BaseHTTPRequestHandler

    pipeline = PolicyMLPipeline()

    class RequestHandler(BaseHTTPRequestHandler):
        def _send_cors(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

        def do_OPTIONS(self):
            self.send_response(204)
            self._send_cors()
            self.end_headers()

        def do_GET(self):
            if self.path in ("/health", "/api/health", "/"):
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._send_cors()
                self.end_headers()
                res = {
                    "status": "healthy",
                    "engine": "scikit-learn (local)",
                    "indexedPolicies": len(pipeline.retriever.policies),
                    "supervisedModelTrained": pipeline.classifier.is_trained
                }
                self.wfile.write(json.dumps(res).encode('utf-8'))
            else:
                self.send_response(404)
                self.end_headers()

        def do_POST(self):
            content_len = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_len)

            try:
                data = json.loads(post_body.decode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self._send_cors()
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Invalid JSON: {str(e)}"}).encode('utf-8'))
                return

            policies = data.get("policies", [])
            ticket = data.get("ticket", "")
            if isinstance(ticket, dict):
                ticket = f"{ticket.get('title', '')} {ticket.get('description', '')}".strip()

            labelled_data = data.get("labelledData")

            result = pipeline.analyze(ticket, policies, labelled_data)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))

    server = HTTPServer(('127.0.0.1', port), RequestHandler)
    print(f"Policy Lookup Python ML Server listening on http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


def main():
    parser = argparse.ArgumentParser(description="Policy Lookup Python ML & Retrieval Engine")
    parser.add_argument("--serve", action="store_true", help="Run HTTP ML API server")
    parser.add_argument("--port", type=int, default=5000, help="Server port (default: 5000)")
    parser.add_argument("--ticket", type=str, help="Ticket text to retrieve matching policy")
    parser.add_argument("--policies", type=str, help="Path to JSON file or JSON string of policies")
    args = parser.parse_args()

    if args.serve:
        run_server(args.port)
        return

    # Process via stdin
    input_data = None
    if not sys.stdin.isatty():
        try:
            stdin_content = sys.stdin.read()
            if stdin_content.strip():
                input_data = json.loads(stdin_content)
        except Exception as e:
            sys.stderr.write(f"Error parsing stdin JSON: {e}\n")

    if input_data:
        policies = input_data.get("policies", [])
        ticket = input_data.get("ticket", "")
        if isinstance(ticket, dict):
            ticket = f"{ticket.get('title', '')} {ticket.get('description', '')}".strip()
        labelled_data = input_data.get("labelledData")

        pipeline = PolicyMLPipeline()
        result = pipeline.analyze(ticket, policies, labelled_data)
        print(json.dumps(result, indent=2))
        return

    if args.ticket:
        policies = []
        if args.policies:
            try:
                if args.policies.endswith('.json'):
                    with open(args.policies, 'r', encoding='utf-8') as f:
                        policies = json.load(f)
                else:
                    policies = json.loads(args.policies)
            except Exception as e:
                sys.stderr.write(f"Error reading policies: {e}\n")
                sys.exit(1)

        pipeline = PolicyMLPipeline()
        result = pipeline.analyze(args.ticket, policies)
        print(json.dumps(result, indent=2))
        return

    parser.print_help()


if __name__ == "__main__":
    main()
