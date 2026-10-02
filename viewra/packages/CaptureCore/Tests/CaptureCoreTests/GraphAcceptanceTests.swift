import XCTest
@testable import CaptureCore

/// Acceptance: capture chain with branches, returnTo (same id), and connect-existing.
final class GraphAcceptanceTests: XCTestCase {
    func testBranchReturnAndConnectExistingNoDuplicateN2() throws {
        let graph = GraphService(propertyId: "prop-1", roomId: "room-1")

        // Capture N1, N2
        let n1 = try graph.createNode(label: "N1", id: "N1")
        let n2 = try graph.createNode(label: "N2", id: "N2")
        XCTAssertEqual(graph.store.currentNodeId, "N2")
        XCTAssertEqual(n1.id, "N1")
        XCTAssertEqual(n2.id, "N2")

        // Branch left: N3 → N4 → N5
        let n3 = try graph.createBranch(label: "N3", direction: .left, id: "N3")
        let n4 = try graph.createNode(label: "N4", id: "N4")
        let n5 = try graph.createNode(label: "N5", id: "N5")
        XCTAssertEqual(n3.id, "N3")
        XCTAssertEqual(n4.id, "N4")
        XCTAssertEqual(n5.id, "N5")
        XCTAssertEqual(graph.store.currentNodeId, "N5")

        // returnTo N2 — EXISTING, no copy
        let returned = try graph.returnToNode(id: "N2")
        XCTAssertEqual(returned.id, "N2")
        XCTAssertEqual(graph.store.currentNodeId, "N2")
        let n2Count = graph.store.nodes.filter { $0.id == "N2" }.count
        XCTAssertEqual(n2Count, 1, "returnToNode must not duplicate N2")
        XCTAssertEqual(graph.store.nodes.count, 5)

        // Branch right: N6 → N7 → N8
        let n6 = try graph.createBranch(label: "N6", direction: .right, id: "N6")
        let n7 = try graph.createNode(label: "N7", id: "N7")
        let n8 = try graph.createNode(label: "N8", id: "N8")
        XCTAssertEqual(n6.id, "N6")
        XCTAssertEqual(n7.id, "N7")
        XCTAssertEqual(n8.id, "N8")
        XCTAssertEqual(graph.store.currentNodeId, "N8")

        // Connect N8 → N2
        let link = try graph.connectExistingNode(to: "N2", direction: .custom)
        XCTAssertEqual(link.fromNodeId, "N8")
        XCTAssertEqual(link.toNodeId, "N2")

        // Still exactly one N2
        XCTAssertEqual(graph.store.nodes.filter { $0.id == "N2" }.count, 1)
        XCTAssertEqual(graph.store.nodes.count, 8)
        XCTAssertEqual(Set(graph.store.nodes.map(\.id)), Set(["N1","N2","N3","N4","N5","N6","N7","N8"]))

        // Assert expected connections
        let pairs = Set(graph.store.connections.map { "\($0.fromNodeId)->\($0.toNodeId)" })
        XCTAssertTrue(pairs.contains("N1->N2"))
        XCTAssertTrue(pairs.contains("N2->N3"))
        XCTAssertTrue(pairs.contains("N3->N4"))
        XCTAssertTrue(pairs.contains("N4->N5"))
        XCTAssertTrue(pairs.contains("N2->N6"))
        XCTAssertTrue(pairs.contains("N6->N7"))
        XCTAssertTrue(pairs.contains("N7->N8"))
        XCTAssertTrue(pairs.contains("N8->N2"))

        // Adjacency for N2: outgoing N3, N6; incoming N1, N8
        let adj = graph.adjacency(of: "N2")
        XCTAssertEqual(Set(adj.outgoing), Set(["N3", "N6"]))
        XCTAssertEqual(Set(adj.incoming), Set(["N1", "N8"]))
    }

    func testDeleteNodeRemovesConnections() throws {
        let graph = GraphService(propertyId: "p", roomId: "r")
        try graph.createNode(label: "A", id: "A")
        try graph.createNode(label: "B", id: "B")
        try graph.createNode(label: "C", id: "C")
        try graph.deleteNode(id: "B")
        XCTAssertFalse(graph.store.containsNode(id: "B"))
        XCTAssertTrue(graph.store.connections.allSatisfy { $0.fromNodeId != "B" && $0.toNodeId != "B" })
    }
}
